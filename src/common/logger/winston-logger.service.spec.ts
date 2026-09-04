import type { WinstonLike } from './winston-logger.service';
import { WinstonLoggerService } from './winston-logger.service';

type WinstonMock = jest.Mocked<Pick<WinstonLike, 'log'>>;

/**
 * Feature #3 (migración a NestJS 12 ESM): `nest-winston` no soporta v12
 * (peer `@nestjs/common ^5..^11`), así que este `LoggerService` propio lo
 * reemplaza. Estas pruebas fijan el contrato exacto de mapeo Nest -> winston
 * descrito en `progress/design_migracion_nestjs_12_esm.md` §2.
 *
 * Seguridad de datos: winston escribe a archivo rotado (queda en disco). El caso
 * "sin contexto registra solo el mensaje" comprueba que NO se cuela ningún
 * metadato adicional que pudiera traer datos de cliente.
 */
describe('WinstonLoggerService', () => {
  let winston: WinstonMock;
  let logger: WinstonLoggerService;

  beforeEach(() => {
    winston = { log: jest.fn() };
    logger = new WinstonLoggerService(winston);
  });

  it('log delega en winston con nivel info y pasa el contexto de NestJS como metadato', () => {
    logger.log('usuario autenticado', 'UsersController');

    expect(winston.log).toHaveBeenCalledWith('info', 'usuario autenticado', {
      context: 'UsersController',
    });
  });

  it('error delega en winston con nivel error e incluye el stack que NestJS envia como segundo parametro', () => {
    logger.error(
      'fallo al procesar la solicitud',
      'Error: fallo\n    at Bootstrap',
      'UsersController',
    );

    expect(winston.log).toHaveBeenCalledWith('error', 'fallo al procesar la solicitud', {
      context: 'UsersController',
      stack: 'Error: fallo\n    at Bootstrap',
    });
  });

  it('warn delega en winston con nivel warn', () => {
    logger.warn('intento de acceso con token vencido', 'JwtStrategy');

    expect(winston.log).toHaveBeenCalledWith('warn', 'intento de acceso con token vencido', {
      context: 'JwtStrategy',
    });
  });

  it('debug y verbose delegan en winston con sus niveles equivalentes', () => {
    logger.debug('consultando repositorio de usuarios', 'UsersService');
    logger.verbose('detalle extendido de la operación', 'UsersService');

    expect(winston.log).toHaveBeenNthCalledWith(1, 'debug', 'consultando repositorio de usuarios', {
      context: 'UsersService',
    });
    expect(winston.log).toHaveBeenNthCalledWith(2, 'verbose', 'detalle extendido de la operación', {
      context: 'UsersService',
    });
  });

  it('fatal se registra en winston con nivel error marcado como fatal', () => {
    logger.fatal('no fue posible conectar a la base de datos', 'Bootstrap');

    expect(winston.log).toHaveBeenCalledWith(
      'error',
      'no fue posible conectar a la base de datos',
      {
        context: 'Bootstrap',
        fatal: true,
      },
    );
  });

  it('sin contexto registra solo el mensaje, sin metadatos adicionales', () => {
    logger.log('servidor iniciado');

    expect(winston.log).toHaveBeenCalledWith('info', 'servidor iniciado');
  });

  /**
   * Batería de la feature #6 (`refactor_buenas_practicas`, `red_modo: caracterizacion`):
   * `normalizarMensaje` no tenía prueba directa de la rama `message instanceof Error`.
   * Un objeto de dominio (crédito, cobranza) NUNCA debe serializarse completo al log.
   */
  it('error registra el message de un Error recibido como mensaje, sin serializar el objeto completo', () => {
    logger.error(new Error('fallo al conectar con el core bancario'));

    expect(winston.log).toHaveBeenCalledWith('error', 'fallo al conectar con el core bancario');
  });
});
