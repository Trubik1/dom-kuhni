import { Router } from 'express';
import Order from '../models/Order.js';
import { validateOrder, validateStatusUpdate } from '../middleware/validation.js';
import { emitNewOrder, emitOrderUpdated } from '../socket.js';
import logger from '../utils/logger.js';
import { formatOrderText, getInlineKeyboard } from '../utils/formatters.js';

const router = Router();

// POST /api/submit-order — приём заявки с сайта
router.post('/submit-order', validateOrder, async (req, res) => {
  try {
    const { name, phone, email, comment, kitchenType, budget, source } = req.body;

    const order = await Order.create({
      name, phone, email, comment, kitchenType, budget, source,
    });

    // Отправка в Telegram
    const bot = req.app.locals.bot;
    const notifyChatId = process.env.GROUP_CHAT_ID || process.env.ADMIN_CHAT_ID;

    if (bot && notifyChatId) {
      try {
        const sent = await bot.sendMessage(
          notifyChatId,
          formatOrderText(order),
          { parse_mode: 'HTML', reply_markup: getInlineKeyboard(order.orderId) }
        );
        order.telegramMessageId = sent.message_id;
        await order.save();
      } catch (tgErr) {
        logger.error('Telegram send failed', { error: tgErr.message, orderId: order.orderId });
      }
    }

    // Realtime-уведомление в дашборд
    emitNewOrder(order.toPublic());

    logger.info('Order created', { orderId: order.orderId });

    res.status(201).json({ success: true, orderId: order.orderId });
  } catch (err) {
    logger.error('Submit order error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/admin/orders — список заявок (с фильтрацией)
router.get('/admin/orders', async (req, res) => {
  try {
    const { status, search, kitchenType, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (kitchenType) filter.kitchenType = kitchenType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { phone: re }, { orderId: re }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders.map(o => o.toPublic()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('Get orders error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// PATCH /api/admin/orders/:id — обновление заявки
router.patch('/admin/orders/:id', validateStatusUpdate, async (req, res) => {
  try {
    const { status, managerComment } = req.body;
    const update = {};
    if (status) update.status = status;
    if (managerComment !== undefined) update.managerComment = managerComment;

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.id },
      { $set: update },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'Заявка не найдена' });
    }

    emitOrderUpdated(order.toPublic());
    logger.info('Order updated', { orderId: order.orderId, status });

    res.json({ success: true, data: order.toPublic() });
  } catch (err) {
    logger.error('Update order error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/admin/orders/:id — детали заявки
router.get('/admin/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заявка не найдена' });
    }
    res.json({ success: true, data: order.toPublic() });
  } catch (err) {
    logger.error('Get order error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/admin/stats — статистика для дашборда
router.get('/admin/stats', async (req, res) => {
  try {
    const [total, byStatus, byType, daily] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $group: { _id: '$kitchenType', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await Order.countDocuments({ createdAt: { $gte: todayStart } });

    const statusMap = { new: 0, in_progress: 0, completed: 0, cancelled: 0 };
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        total,
        today: todayCount,
        byStatus: statusMap,
        byType: byType.map(t => ({ type: t._id || 'Не указан', count: t.count })),
        daily: daily.map(d => ({ date: d._id, count: d.count })),
      },
    });
  } catch (err) {
    logger.error('Stats error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/admin/orders/export — экспорт CSV
router.post('/admin/orders/export', async (req, res) => {
  try {
    const { status, from, to } = req.body;
    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    const header = 'ID,Имя,Телефон,Email,Комментарий,Тип кухни,Бюджет,Источник,Статус,Комментарий менеджера,Дата\n';
    const rows = orders.map(o =>
      `"${o.orderId}","${o.name}","${o.phone}","${o.email || ''}","${(o.comment || '').replace(/"/g, '""')}","${o.kitchenType || ''}","${o.budget || ''}","${o.source || ''}","${o.status}","${(o.managerComment || '').replace(/"/g, '""')}","${new Date(o.createdAt).toISOString()}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=orders-${Date.now()}.csv`);
    res.send('\uFEFF' + header + rows);
  } catch (err) {
    logger.error('Export error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

export default router;
