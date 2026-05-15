import logger from '../utils/logger.js';

// 404 handler — must be registered AFTER all routes
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
  });
}

// Global error handler — must have 4 parameters (Express signature)
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  logger.error('Unhandled request error', {
    method:  req.method,
    path:    req.path,
    message: err.message,
    code:    err.code,
    stack:   err.stack?.split('\n').slice(0, 4).join(' | '),
  });

  // Prisma unique violation — surfaced safely
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, error: 'Duplicate record', code: 'P2002' });
  }

  // Prisma connection errors
  if (err.constructor?.name?.startsWith('Prisma')) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  const status = err.status ?? err.statusCode ?? 500;
  return res.status(status).json({
    success: false,
    error:   err.message ?? 'Internal server error',
  });
}
