import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = path.resolve('./logs');
fs.ensureDirSync(logsDir);

const { combine, timestamp, printf, colorize, errors } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const base = `${ts} [${level}] ${stack || message}`;
  return base;
});

const fileFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level.toUpperCase()}] ${stack || message}${metaStr}`;
});

const logLevel = process.env.LOG_LEVEL || 'info';
const logToFile = process.env.LOG_TO_FILE !== 'false';

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: logLevel,
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      consoleFormat
    ),
  }),
];

if (logToFile) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'agent.log'),
      level: 'debug',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
      format: combine(timestamp(), errors({ stack: true }), fileFormat),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      format: combine(timestamp(), errors({ stack: true }), fileFormat),
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  transports,
  exitOnError: false,
});

// Stream for express morgan (if needed)
export const logStream = {
  write: (message: string) => logger.http(message.trim()),
};
