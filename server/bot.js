import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { createServer } from 'http';
import TelegramBot from 'node-telegram-bot-api';
import apiRoutes from './routes/api.js';
import authRoutes, { initAdmin } from './routes/auth.js';
import { initSocket, getIO } from './socket.js';
import Order from './models/Order.js';
import logger from './utils/logger.js';
import {
  formatOrderText, formatOrderShort, statusEmoji,
  getInlineKeyboard, escapeHtml,
} from './utils/formatters.js';

// ====== Конфигурация ======
const PORT = process.env.PORT || 3000;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5173';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dom-kuhni';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====== Инициализация Express ======
const app = express();
const httpServer = createServer(app);

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(cors({
  origin: [ADMIN_URL, 'https://trubik1.github.io'].filter(Boolean),
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Слишком много запросов, повторите позже' },
});
app.use('/api/', limiter);

// Специальный лимит для submit-order
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Превышен лимит заявок (20/час)' },
});
app.post('/api/submit-order', orderLimiter);

// ====== Telegram Bot ======
let bot = null;

if (BOT_TOKEN) {
  if (NODE_ENV === 'production') {
    // Webhook mode
    bot = new TelegramBot(BOT_TOKEN);
    bot.setWebHook(`${BASE_URL}/webhook/${BOT_TOKEN}`);
    app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
  } else {
    // Polling mode (dev)
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
  }

  app.locals.bot = bot;

  // ====== Команды бота ======

  // /start
  bot.onText(/\/start/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) {
      return bot.sendMessage(msg.chat.id, '⛔ Доступ запрещён');
    }
    const cmds = [
      '👋 Привет! Я бот заявок "Дом кухни"',
      '',
      '/new — новые заявки',
      '/stats — статистика',
      '/export_csv — экспорт в CSV',
    ].join('\n');
    await bot.sendMessage(msg.chat.id, cmds);
  });

  // /new — показать новые заявки
  bot.onText(/\/new/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const orders = await Order.find({ status: 'new' }).sort({ createdAt: -1 }).limit(10);
      if (!orders.length) {
        return bot.sendMessage(msg.chat.id, '✅ Новых заявок нет');
      }
      for (const order of orders) {
        await bot.sendMessage(
          msg.chat.id,
          formatOrderText(order),
          { parse_mode: 'HTML', reply_markup: getInlineKeyboard(order.orderId) }
        );
      }
    } catch (err) {
      logger.error('/new error', { error: err.message });
      bot.sendMessage(msg.chat.id, '❌ Ошибка загрузки заявок');
    }
  });

  // /stats
  bot.onText(/\/stats/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const [total, byStatus, today] = await Promise.all([
        Order.countDocuments(),
        Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Order.countDocuments({
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        }),
      ]);

      const lines = [
        '📊 <b>Статистика</b>',
        '',
        `📦 Всего заявок: <b>${total}</b>`,
        `📅 За сегодня: <b>${today}</b>`,
        '',
      ];
      byStatus.forEach(s => {
        lines.push(`${statusEmoji(s._id)} ${statusLabel(s._id)}: <b>${s.count}</b>`);
      });

      await bot.sendMessage(msg.chat.id, lines.join('\n'), { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('/stats error', { error: err.message });
      bot.sendMessage(msg.chat.id, '❌ Ошибка статистики');
    }
  });

  // /export_csv
  bot.onText(/\/export_csv/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
      const header = 'ID,Имя,Телефон,Email,Комментарий,Тип кухни,Бюджет,Источник,Статус,Комментарий менеджера,Дата\n';
      const rows = orders.map(o =>
        `"${o.orderId}","${o.name}","${o.phone}","${o.email || ''}","${(o.comment || '').replace(/"/g, '""')}","${o.kitchenType || ''}","${o.budget || ''}","${o.source || ''}","${o.status}","${(o.managerComment || '').replace(/"/g, '""')}","${new Date(o.createdAt).toISOString()}"`
      ).join('\n');

      await bot.sendDocument(msg.chat.id, Buffer.from('\uFEFF' + header + rows, 'utf-8'), {
        filename: `orders-${Date.now()}.csv`,
        caption: '📊 Экспорт заявок',
      });
    } catch (err) {
      logger.error('/export_csv error', { error: err.message });
      bot.sendMessage(msg.chat.id, '❌ Ошибка экспорта');
    }
  });

  // ====== Callback-кнопки ======
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (chatId.toString() !== ADMIN_CHAT_ID) {
      return bot.answerCallbackQuery(query.id, { text: '⛔ Доступ запрещён' });
    }

    const [action, orderId] = query.data.split('_');
    let order;

    try {
      order = await Order.findOne({ orderId });
      if (!order) {
        return bot.answerCallbackQuery(query.id, { text: '❌ Заявка не найдена' });
      }

      const io = getIO();

      switch (action) {
        case 'accept':
          order.status = 'in_progress';
          await order.save();
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id }
          );
          await bot.sendMessage(chatId, `✅ Заявка #${orderId} принята`);
          if (io) io.emit('order-updated', order.toPublic());
          break;

        case 'reject':
          order.status = 'cancelled';
          await order.save();
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id }
          );
          await bot.sendMessage(chatId, `❌ Заявка #${orderId} отклонена`);
          if (io) io.emit('order-updated', order.toPublic());
          break;

        case 'call':
          await bot.sendMessage(chatId, `📞 Позвонить клиенту: <b>${escapeHtml(order.phone)}</b>`, { parse_mode: 'HTML' });
          await bot.answerCallbackQuery(query.id, { text: `Номер: ${order.phone}` });
          break;

        case 'whatsapp':
          const phoneClean = order.phone.replace(/[\s\-\(\)]/g, '');
          const waLink = `https://wa.me/${phoneClean}`;
          await bot.sendMessage(chatId, `💬 <a href="${waLink}">WhatsApp: ${escapeHtml(order.phone)}</a>`, { parse_mode: 'HTML', disable_web_page_preview: true });
          await bot.answerCallbackQuery(query.id, { text: 'Ссылка на WhatsApp отправлена' });
          break;
      }

      logger.info(`Callback ${action} for #${orderId}`);
    } catch (err) {
      logger.error('Callback error', { action, orderId, error: err.message });
      await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
    }
  });

  // Обработка ошибок Telegram
  bot.on('polling_error', (err) => {
    logger.error('Telegram polling error', { error: err.message });
  });
} else {
  logger.warn('BOT_TOKEN не задан, бот не запущен');
}

// ====== Routes ======
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
app.use('/api', apiRoutes);
app.use('/api', authRoutes);

// ====== MongoDB + Startup ======
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected');

    await initAdmin();

    const io = initSocket(httpServer, ADMIN_URL);
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} (${NODE_ENV})`);
      if (bot && NODE_ENV === 'production') {
        logger.info(`Webhook set: ${BASE_URL}/webhook/${BOT_TOKEN}`);
      }
    });
  } catch (err) {
    logger.error('Startup error', { error: err.message });
    process.exit(1);
  }
}

start();
