import xss from 'xss';

const PHONE_RE = /^[\d\s+\-()]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[a-zA-Zа-яА-ЯёЁ\s\-]{2,100}$/;
const ALLOWED_STATUSES = ['new', 'in_progress', 'completed', 'cancelled'];

function sanitize(str) {
  return xss( (str || '').trim().slice(0, 2000) );
}

export function validateOrder(req, res, next) {
  const errors = [];
  const { name, phone, email, comment, kitchenType, budget, source } = req.body;

  if (!name || !NAME_RE.test(name)) {
    errors.push('Имя: 2–100 символов, только буквы и пробел');
  }
  if (!phone || !PHONE_RE.test(phone)) {
    errors.push('Телефон: 7–20 цифр, допускаются +-() и пробелы');
  }
  if (email && !EMAIL_RE.test(email)) {
    errors.push('Email: неверный формат');
  }
  if (req.body._honeypot) {
    return res.status(400).json({ success: false, error: 'Spam detected' });
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.name = sanitize(name);
  req.body.phone = sanitize(phone);
  req.body.email = email ? sanitize(email) : '';
  req.body.comment = comment ? sanitize(comment) : '';
  req.body.kitchenType = kitchenType ? sanitize(kitchenType) : '';
  req.body.budget = budget ? sanitize(budget) : '';
  req.body.source = source ? sanitize(source) : 'Сайт';
  delete req.body._honeypot;

  next();
}

export function validateStatusUpdate(req, res, next) {
  const { status } = req.body;
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `Недопустимый статус: ${status}` });
  }
  next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email и пароль обязательны' });
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Неверный формат email' });
  }
  next();
}
