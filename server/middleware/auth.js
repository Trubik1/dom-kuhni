import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function verifyToken(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Недействительный токен' });
  }
}

export function checkChatId(req, res, next) {
  if (req.body?.message?.chat?.id?.toString() !== process.env.ADMIN_CHAT_ID) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}
