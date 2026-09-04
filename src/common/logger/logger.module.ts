import { Global, Module } from '@nestjs/common';
import * as winston from 'winston';
import { buildWinstonOptions } from './winston.config';
import { WinstonLoggerService } from './winston-logger.service';
import { APP_LOGGER } from './logger.tokens';

/**
 * Módulo global que provee el logger de la aplicación. Reemplaza a
 * `WinstonModule.forRoot(...)` de `nest-winston` (sin soporte para NestJS
 * 12).
 *
 * Dos formas de registro, por dos razones distintas:
 * - `useExisting` (no `useClass`) para que el token `APP_LOGGER` y la clase
 *   `WinstonLoggerService` apunten a la MISMA instancia. Una segunda
 *   instancia abriría un segundo juego de transports y duplicaría cada
 *   línea en los archivos rotados.
 * - Se exporta también la clase para que `main.ts` pueda resolverla
 *   tipada (`app.get(WinstonLoggerService)`); resolver por el token string
 *   (`app.get(APP_LOGGER)`) devuelve `any` y dispararía
 *   `@typescript-eslint/no-unsafe-argument` en `app.useLogger(...)`.
 */
@Global()
@Module({
  providers: [
    {
      provide: WinstonLoggerService,
      useFactory: () => new WinstonLoggerService(winston.createLogger(buildWinstonOptions())),
    },
    { provide: APP_LOGGER, useExisting: WinstonLoggerService },
  ],
  exports: [WinstonLoggerService, APP_LOGGER],
})
export class LoggerModule {}
