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
import PageView from './models/PageView.js';
import logger from './utils/logger.js';
import {
  formatOrderText, formatOrderAlert, statusEmoji, escapeHtml,
} from './utils/formatters.js';

// ====== Config ======
const PORT = process.env.PORT || 3000;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID || ADMIN_CHAT_ID;
const ALLOWED_IDS = [ADMIN_CHAT_ID, ...(process.env.ADDITIONAL_ADMINS || '').split(',').filter(Boolean).map(s => s.trim())];
const PER_PAGE = 5;

function isAdmin(userId) {
  return ALLOWED_IDS.includes(userId?.toString());
}
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5173';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dom-kuhni';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====== Express ======
const app = express();
const httpServer = createServer(app);

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(cors({
  origin: [ADMIN_URL, 'https://trubik1.github.io'].filter(Boolean),
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { success: false, error: 'Слишком много запросов, повторите позже' },
});
app.use('/api/', limiter);

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20,
  message: { success: false, error: 'Превышен лимит заявок (20/час)' },
});
app.post('/api/submit-order', orderLimiter);

// ====== Bot state ======
const userState = new Map();
// { filter: 'all'|'new'|'in_progress'|'completed'|'cancelled', page: 0, totalPages: 1 }

function getState(chatId) {
  if (!userState.has(chatId)) {
    userState.set(chatId, { filter: 'all', page: 0, totalPages: 1 });
  }
  return userState.get(chatId);
}

// ====== Keyboard builders ======
function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📋 Заявки', callback_data: 'menu_orders' },
       { text: '📊 Статистика', callback_data: 'm_stats' }],
      [{ text: '👁 Аналитика', callback_data: 'm_analytics' },
       { text: '🔄 Обновить', callback_data: 'm_main' }],
    ],
  };
}

function statusFilterKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🆕 Новые', callback_data: 'f_new' },
       { text: '🔄 В работе', callback_data: 'f_ip' }],
      [{ text: '✅ Завершённые', callback_data: 'f_done' },
       { text: '❌ Отменённые', callback_data: 'f_cancel' }],
      [{ text: '📅 Сегодня', callback_data: 'f_today' },
       { text: '📋 Все', callback_data: 'f_all' }],
      [{ text: '🏠 Главное меню', callback_data: 'm_main' }],
    ],
  };
}

function orderNavKeyboard(orderId, page, totalPages, filter) {
  const nav = [];
  const row = [];
  if (page > 0) row.push({ text: '⬅️', callback_data: 'nav_prev' });
  row.push({ text: `${page + 1}/${totalPages}`, callback_data: 'nav_cur' });
  if (page < totalPages - 1) row.push({ text: '➡️', callback_data: 'nav_next' });
  nav.push(row);

  const statusLabels = { new: '🆕', in_progress: '🔄', completed: '✅', cancelled: '❌' };
  nav.push([
    { text: `${statusLabels[filter] || '📋'} ${filter === 'all' ? 'Все' : filter}`, callback_data: 'menu_orders' },
  ]);

  nav.push([
    { text: '✅ Принять', callback_data: `a_${orderId}` },
    { text: '❌ Отклонить', callback_data: `r_${orderId}` },
  ]);
  nav.push([
    { text: '✅ Завершить', callback_data: `d_${orderId}` },
  ]);
  nav.push([
    { text: '📞 Позвонить', callback_data: `c_${orderId}` },
    { text: '💬 WhatsApp', callback_data: `w_${orderId}` },
  ]);
  nav.push([
    { text: '🏠 Меню', callback_data: 'm_main' },
  ]);
  return { inline_keyboard: nav };
}

// ====== Menu renderers ======
async function showMainMenu(chatId, msgId) {
  const text = [
    '👋 <b>Меню администратора</b>',
    '',
    '📋 <b>Заявки</b> — управление',
    '📊 <b>Статистика</b> — отчёты',
    '👁 <b>Аналитика</b> — посещаемость',
    '🔄 <b>Обновить</b> — перезагрузить',
  ].join('\n');
  if (msgId) {
    await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: mainMenuKeyboard() });
  } else {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() });
  }
}

async function showOrdersMenu(chatId, msgId) {
  const text = '📋 <b>Выберите статус заявок:</b>';
  if (msgId) {
    await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: statusFilterKeyboard() });
  } else {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: statusFilterKeyboard() });
  }
}

async function showOrderList(chatId, filter, page, msgId) {
  const query = {};
  if (filter === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    query.createdAt = { $gte: start };
  } else if (filter !== 'all') {
    query.status = filter;
  }

  const total = await Order.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const p = Math.min(page, totalPages - 1);
  const state = getState(chatId);
  state.filter = filter;
  state.page = p;
  state.totalPages = totalPages;

  if (total === 0) {
    const empty = '📭 <b>Нет заявок</b>';
    if (msgId) {
      await bot.editMessageText(empty, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: statusFilterKeyboard() });
    } else {
      await bot.sendMessage(chatId, empty, { parse_mode: 'HTML', reply_markup: statusFilterKeyboard() });
    }
    return;
  }

  const orders = await Order.find(query).sort({ createdAt: -1 }).skip(p * PER_PAGE).limit(PER_PAGE).lean();

  for (const order of orders) {
    const navKb = orderNavKeyboard(order.orderId, p, totalPages, filter);
    await bot.sendMessage(chatId, formatOrderText(order), { parse_mode: 'HTML', reply_markup: navKb });
  }

  if (msgId) {
    try { await bot.deleteMessage(chatId, msgId); } catch (_) {}
  }
}

async function showStats(chatId, msgId) {
  const [total, byStatus, today, byType] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Order.aggregate([
      { $group: { _id: '$kitchenType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const statusMap = { new: 0, in_progress: 0, completed: 0, cancelled: 0 };
  byStatus.forEach(s => { statusMap[s._id] = s.count; });

  const lines = [
    '📊 <b>Статистика заявок</b>',
    '',
    `📦 Всего: <b>${total}</b>`,
    `📅 Сегодня: <b>${today}</b>`,
    '',
    `${statusEmoji('new')} Новые: <b>${statusMap.new}</b>`,
    `${statusEmoji('in_progress')} В работе: <b>${statusMap.in_progress}</b>`,
    `${statusEmoji('completed')} Завершённые: <b>${statusMap.completed}</b>`,
    `${statusEmoji('cancelled')} Отменённые: <b>${statusMap.cancelled}</b>`,
    '',
    '🍳 <b>По типу кухни:</b>',
    ...byType.map(t => `  ${escapeHtml(t._id || 'Не указан')}: ${t.count}`),
  ];

  const kb = {
    inline_keyboard: [
      [{ text: '📋 Заявки', callback_data: 'menu_orders' },
       { text: '🏠 Меню', callback_data: 'm_main' }],
    ],
  };

  if (msgId) {
    await bot.editMessageText(lines.join('\n'), { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
  } else {
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb });
  }
}

async function showAnalytics(chatId, msgId) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [today, week, total, topPages, activeNow] = await Promise.all([
    PageView.countDocuments({ createdAt: { $gte: todayStart } }),
    PageView.countDocuments({ createdAt: { $gte: weekStart } }),
    PageView.countDocuments(),
    PageView.aggregate([
      { $group: { _id: '$page', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    PageView.getActiveNow(),
  ]);

  const lines = [
    '👁 <b>Аналитика посещений</b>',
    '',
    `📅 Сегодня: <b>${today}</b>`,
    `📅 Неделя: <b>${week}</b>`,
    `📊 Всего: <b>${total}</b>`,
    `🔥 Сейчас на сайте: <b>${activeNow.length}</b>`,
    '',
    '📄 <b>Популярные страницы:</b>',
    ...(topPages.length ? topPages.map((p, i) => `  ${i + 1}. ${p._id} — ${p.count}`) : ['  (нет данных)']),
  ];

  const kb = {
    inline_keyboard: [
      [{ text: '🔄 Обновить', callback_data: 'm_analytics' },
       { text: '🏠 Меню', callback_data: 'm_main' }],
    ],
  };

  if (msgId) {
    await bot.editMessageText(lines.join('\n'), { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb });
  } else {
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb });
  }
}

const replyKb = {
  keyboard: [
    [{ text: '📋 Заявки' }, { text: '📊 Статистика' }],
    [{ text: '👁 Аналитика' }],
  ],
  resize_keyboard: true,
};

// ====== Telegram Bot ======
let bot = null;

if (BOT_TOKEN) {
  if (NODE_ENV === 'production') {
    bot = new TelegramBot(BOT_TOKEN);
    bot.setWebHook(`${BASE_URL}/webhook/${BOT_TOKEN}`);
    app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
  } else {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
  }

  app.locals.bot = bot;

  bot.setMyCommands([
    { command: 'start', description: '🏠 Главное меню' },
    { command: 'orders', description: '📋 Заявки' },
    { command: 'stats', description: '📊 Статистика' },
    { command: 'analytics', description: '👁 Аналитика' },
  ]);

  // /start
  bot.onText(/\/start/, async (msg) => {
    if (!isAdmin(msg.from?.id)) {
      return bot.sendMessage(msg.chat.id, '⛔ Доступ запрещён');
    }
    await bot.sendMessage(msg.chat.id, '👋 Добро пожаловать!', { reply_markup: replyKb });
    await showMainMenu(msg.chat.id);
  });

  // /orders
  bot.onText(/\/orders/, async (msg) => {
    if (!isAdmin(msg.from?.id)) return;
    await showOrdersMenu(msg.chat.id);
  });

  // /stats
  bot.onText(/\/stats/, async (msg) => {
    if (!isAdmin(msg.from?.id)) return;
    await showStats(msg.chat.id);
  });

  // /analytics
  bot.onText(/\/analytics/, async (msg) => {
    if (!isAdmin(msg.from?.id)) return;
    await showAnalytics(msg.chat.id);
  });

  // Text reply buttons
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return;
    if (!msg.text || !isAdmin(msg.from?.id)) return;

    const chatId = msg.chat.id;
    if (msg.text === '📋 Заявки') await showOrdersMenu(chatId);
    else if (msg.text === '📊 Статистика') await showStats(chatId);
    else if (msg.text === '👁 Аналитика') await showAnalytics(chatId);
  });

  // ====== Callback queries ======
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    if (!isAdmin(query.from?.id)) {
      return bot.answerCallbackQuery(query.id, { text: '⛔ Доступ запрещён' });
    }

    try {
      // --- Navigation ---
      if (data === 'm_main') {
        await showMainMenu(chatId, msgId);
        return bot.answerCallbackQuery(query.id);
      }
      if (data === 'menu_orders') {
        await showOrdersMenu(chatId, msgId);
        return bot.answerCallbackQuery(query.id);
      }
      if (data === 'm_stats') {
        await showStats(chatId, msgId);
        return bot.answerCallbackQuery(query.id);
      }
      if (data === 'm_analytics') {
        await showAnalytics(chatId, msgId);
        return bot.answerCallbackQuery(query.id);
      }

      // --- Filters ---
      if (data.startsWith('f_')) {
        const filterMap = { f_new: 'new', f_ip: 'in_progress', f_done: 'completed', f_cancel: 'cancelled', f_all: 'all', f_today: 'today' };
        const filter = filterMap[data] || 'all';
        const state = getState(chatId);
        state.filter = filter;
        state.page = 0;
        await showOrderList(chatId, filter, 0, msgId);
        return bot.answerCallbackQuery(query.id);
      }

      // --- Page indicator (no-op) ---
      if (data === 'nav_cur') {
        return bot.answerCallbackQuery(query.id, { text: `Страница ${getState(chatId).page + 1} из ${getState(chatId).totalPages}` });
      }

      // --- Navigation prev/next ---
      if (data === 'nav_prev' || data === 'nav_next') {
        const state = getState(chatId);
        if (data === 'nav_prev' && state.page > 0) state.page--;
        if (data === 'nav_next' && state.page < state.totalPages - 1) state.page++;
        // Delete old messages and show fresh
        try { await bot.deleteMessage(chatId, msgId); } catch (_) {}
        await showOrderList(chatId, state.filter, state.page);
        return bot.answerCallbackQuery(query.id);
      }

      // --- Order actions ---
      const prefix = data[0];
      const orderId = data.slice(2);
      const order = await Order.findOne({ orderId });
      if (!order) {
        return bot.answerCallbackQuery(query.id, { text: '❌ Заявка не найдена' });
      }

      const io = getIO();

      switch (prefix) {
        case 'a': // accept
          order.status = 'in_progress';
          await order.save();
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId });
          await bot.sendMessage(chatId, `✅ Заявка #${orderId} принята`);
          if (io) io.emit('order-updated', order.toPublic());
          break;

        case 'r': // reject
          order.status = 'cancelled';
          await order.save();
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId });
          await bot.sendMessage(chatId, `❌ Заявка #${orderId} отклонена`);
          if (io) io.emit('order-updated', order.toPublic());
          break;

        case 'd': // done / complete
          order.status = 'completed';
          await order.save();
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId });
          await bot.sendMessage(chatId, `✅ Заявка #${orderId} завершена`);
          if (io) io.emit('order-updated', order.toPublic());
          break;

        case 'c': // call
          await bot.sendMessage(chatId, `📞 Позвонить: <b>${escapeHtml(order.phone)}</b>`, { parse_mode: 'HTML' });
          await bot.answerCallbackQuery(query.id, { text: `Номер: ${order.phone}` });
          break;

        case 'w': // whatsapp
          const phoneClean = order.phone.replace(/[\s\-\(\)]/g, '');
          const waLink = `https://wa.me/${phoneClean}`;
          await bot.sendMessage(chatId, `💬 <a href="${waLink}">WhatsApp: ${escapeHtml(order.phone)}</a>`, { parse_mode: 'HTML', disable_web_page_preview: true });
          await bot.answerCallbackQuery(query.id, { text: 'Ссылка на WhatsApp' });
          break;
      }

      logger.info(`Bot action ${prefix} for #${orderId}`);
    } catch (err) {
      logger.error('Callback error', { data, error: err.message });
      await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
    }
  });

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

// ====== Startup ======
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
