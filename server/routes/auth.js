import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { validateLogin } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dom-kuhni.by';
let adminPasswordHash = null;

// Инициализация пароля при первом запуске
export async function initAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    logger.warn('ADMIN_PASSWORD не задан, используется пароль по умолчанию');
    adminPasswordHash = await bcrypt.hash('admin123', 10);
    return;
  }
  adminPasswordHash = await bcrypt.hash(password, 10);
  logger.info('Admin initialized');
}

// POST /api/admin/auth/login
router.post('/admin/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL) {
      return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
    }

    if (!adminPasswordHash) await initAdmin();
    const valid = await bcrypt.compare(password, adminPasswordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { email: ADMIN_EMAIL, role: 'admin' },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    logger.info('Admin logged in');

    res.json({ success: true, token, admin: { email: ADMIN_EMAIL } });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/admin/auth/logout
router.post('/admin/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// GET /api/admin/auth/me — проверка токена
router.get('/admin/auth/me', (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Не авторизован' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, admin: { email: decoded.email } });
  } catch {
    res.status(401).json({ success: false, error: 'Токен истёк' });
  }
});

export default router;
