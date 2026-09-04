import { Test } from '@nestjs/testing';
import type { LoggerService } from '@nestjs/common';
import { LoggerModule } from './logger.module';
import { WinstonLoggerService } from './winston-logger.service';
import { APP_LOGGER } from './logger.tokens';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

type LoggerDouble = jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>;

/**
 * Feature #3 (migración a NestJS 12 ESM): este es el único test de la
 * batería que atrapa el modo de falla real de la migración del logger — una
 * dependencia sin resolver que solo aparece al levantar la app. Los specs
 * que construyen `HttpExceptionFilter` con `new` nunca ven el token de
 * inyección; este sí, porque compila el módulo real.
 *
 * `overrideProvider` es obligatorio: sin él, `LoggerModule` construiría el
 * `winston.createLogger` real y la suite escribiría en `./logs/`.
 */
describe('LoggerModule', () => {
  it('LoggerModule expone APP_LOGGER y HttpExceptionFilter se resuelve por DI sin nest-winston', async () => {
    const doble: LoggerDouble = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [HttpExceptionFilter],
    })
      .overrideProvider(WinstonLoggerService)
      .useValue(doble)
      .compile();

    const filter = moduleRef.get(HttpExceptionFilter);

    expect(filter).toBeInstanceOf(HttpExceptionFilter);
    expect(moduleRef.get(APP_LOGGER)).toBe(doble);
  });
});
