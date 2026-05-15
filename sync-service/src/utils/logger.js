import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = format;

// Single-line format: [HH:mm:ss] LEVEL: message  {meta}
const lineFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? `  ${JSON.stringify(meta)}` : '';
  return `[${ts}] ${level}: ${stack ?? message}${extra}`;
});

const logger = createLogger({
  level: env.log.level,
  format: combine(timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), lineFormat),
  transports: [
    // Console — colorized for human reading
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        lineFormat,
      ),
    }),

    // Rolling daily file — all levels
    new DailyRotateFile({
      dirname:       env.log.dir,
      filename:      'sync-%DATE%.log',
      datePattern:   'YYYY-MM-DD',
      maxFiles:      '14d',
      maxSize:       '20m',
      zippedArchive: true,
    }),

    // Rolling daily file — errors only (for alerting / post-mortem)
    new DailyRotateFile({
      dirname:       env.log.dir,
      filename:      'sync-error-%DATE%.log',
      datePattern:   'YYYY-MM-DD',
      level:         'error',
      maxFiles:      '30d',
      maxSize:       '20m',
      zippedArchive: true,
    }),
  ],
});

export default logger;
