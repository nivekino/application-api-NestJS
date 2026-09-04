import * as os from 'os';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { WinstonModuleOptions } from 'nest-winston';

/**
 * Configuración de Winston equivalente a la del origen Express:
 * - Consola coloreada.
 * - Rotación diaria de archivos de error y de aplicación.
 * - `level` según NODE_ENV (debug en dev, info en prod).
 *
 * Seguridad Kata: nunca se registran contraseñas, JWT_SECRET ni cadenas de
 * conexión. Los formatters solo serializan los metadatos que se les pasan.
 */
export function buildWinstonOptions(): WinstonModuleOptions {
  const env = process.env.NODE_ENV ?? 'development';
  const level = env === 'development' ? 'debug' : 'info';

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: env === 'test' ? 'error' : level,
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new DailyRotateFile({
      level: 'error',
      filename: './logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),
    new DailyRotateFile({
      filename: './logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),
  ];

  return {
    level,
    format: fileFormat,
    transports,
    exitOnError: false,
    defaultMeta: { service: 'Application-api', hostname: os.hostname() },
  };
}
