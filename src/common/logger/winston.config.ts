import * as os from 'node:os';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { NodeEnvironment } from '../../config/env.validation';

// `process.env.NODE_ENV` es `string` en crudo (el logger existe antes que
// ConfigModule, así que no pasa por `validateEnv`): se compara contra estas
// constantes, anchadas explícitamente a `string`, para no comparar dos tipos
// que el compilador no puede garantizar que compartan el mismo dominio
// (@typescript-eslint/no-unsafe-enum-comparison), sin perder el catálogo
// único de entornos de `env.validation.ts`.
const DEVELOPMENT: string = NodeEnvironment.Development;
const TEST: string = NodeEnvironment.Test;

/**
 * Configuración de Winston equivalente a la del origen Express:
 * - Consola coloreada.
 * - Rotación diaria de archivos de error y de aplicación.
 * - `level` según NODE_ENV (debug en dev, info en prod).
 *
 * Seguridad de datos: nunca se registran contraseñas, JWT_SECRET ni cadenas de
 * conexión. Los formatters solo serializan los metadatos que se les pasan.
 */
export function buildWinstonOptions(): winston.LoggerOptions {
  // `env` viene de `process.env` en crudo (el logger existe antes que
  // ConfigModule, así que no se valida con `validateEnv`): se tipa como
  // `string`, no como `NodeEnvironment`, y por eso se compara contra el
  // valor de cadena del enum (plantilla literal) en vez del miembro del
  // enum, para no comparar dos tipos que el compilador no puede garantizar
  // que compartan el mismo dominio (@typescript-eslint/no-unsafe-enum-comparison).
  const env = process.env.NODE_ENV ?? DEVELOPMENT;
  const level = env === DEVELOPMENT ? 'debug' : 'info';

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: env === TEST ? 'error' : level,
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
