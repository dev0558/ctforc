import config from '../../config.js';

export function authMiddleware(req, res, next) {
  if (config.nodeEnv === 'development') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== config.authToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  next();
}
