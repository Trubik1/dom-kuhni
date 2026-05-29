export function formatOrderText(order) {
  return [
    `🆕 <b>Заявка #${order.orderId}</b>`,
    ``,
    `👤 <b>Имя:</b> ${escapeHtml(order.name)}`,
    `📞 <b>Телефон:</b> ${escapeHtml(order.phone)}`,
    order.email ? `📧 <b>Email:</b> ${escapeHtml(order.email)}` : null,
    order.comment ? `💬 <b>Комментарий:</b> ${escapeHtml(order.comment)}` : null,
    `🍳 <b>Тип кухни:</b> ${escapeHtml(order.kitchenType || 'Не указан')}`,
    `💰 <b>Бюджет:</b> ${escapeHtml(order.budget || 'Не указан')}`,
    `🕐 <b>Дата:</b> ${new Date(order.createdAt).toLocaleString('ru-RU')}`,
  ].filter(Boolean).join('\n');
}

export function formatOrderAlert(order) {
  return `🔔 <b>Новая заявка!</b>\n👤 ${escapeHtml(order.name)}  |  📞 ${escapeHtml(order.phone)}`;
}

export function formatOrderShort(order) {
  return `#${order.orderId} | ${order.name} | ${order.phone} | ${order.status}`;
}

export function statusEmoji(status) {
  const map = {
    new: '🆕', in_progress: '🔄', completed: '✅', cancelled: '❌',
  };
  return map[status] || '❓';
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getInlineKeyboard(orderId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Принять', callback_data: `accept_${orderId}` },
        { text: '❌ Отклонить', callback_data: `reject_${orderId}` },
      ],
      [
        { text: '📞 Позвонить', callback_data: `call_${orderId}` },
        { text: '💬 WhatsApp', callback_data: `whatsapp_${orderId}` },
      ],
    ],
  };
}

export function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Статистика' }, { text: '🆕 Новые заявки' }],
    ],
    resize_keyboard: true,
  };
}
