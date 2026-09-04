import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { buildWinstonOptions } from './winston.config';

/**
 * Prueba de caracterización (feature #6 `refactor_buenas_practicas`,
 * `red_modo: caracterizacion`): `buildWinstonOptions` tenía 0 % de cobertura
 * (`logger.module.spec.ts` sustituye el provider real por un mock, así que la
 * fábrica nunca se ejercitaba). Fija el nivel por entorno, los tres transportes
 * y el `defaultMeta` hoy existentes, antes del refactor R8 (`node:os` +
 * `NodeEnvironment`).
 *
 * Cada caso guarda y restaura `process.env.NODE_ENV` para no filtrar estado
 * entre pruebas ni afectar al resto de la suite.
 */
describe('buildWinstonOptions', () => {
  const nodeEnvOriginal = process.env.NODE_ENV;

  afterEach(() => {
    if (nodeEnvOriginal === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnvOriginal;
    }
  });

  const obtenerConsola = (
    transports: (winston.transport | undefined)[],
  ): winston.transports.ConsoleTransportInstance => {
    const consola = transports.find(
      (t): t is winston.transports.ConsoleTransportInstance =>
        t instanceof winston.transports.Console,
    );
    if (!consola) {
      throw new Error('buildWinstonOptions no incluyo un transporte de Console');
    }
    return consola;
  };

  const obtenerRotados = (transports: (winston.transport | undefined)[]): DailyRotateFile[] =>
    transports.filter((t): t is DailyRotateFile => t instanceof DailyRotateFile);

  it('buildWinstonOptions usa nivel debug en development e info en cualquier otro entorno', () => {
    process.env.NODE_ENV = 'development';
    expect(buildWinstonOptions().level).toBe('debug');

    process.env.NODE_ENV = 'production';
    expect(buildWinstonOptions().level).toBe('info');
  });

  it('buildWinstonOptions baja la consola a nivel error cuando NODE_ENV es test', () => {
    process.env.NODE_ENV = 'test';
    const options = buildWinstonOptions();
    const transports = Array.isArray(options.transports)
      ? options.transports
      : [options.transports];

    expect(obtenerConsola(transports).level).toBe('error');
  });

  it('buildWinstonOptions arma tres transportes: consola, archivo rotado de error y archivo rotado de aplicacion', () => {
    process.env.NODE_ENV = 'production';
    const options = buildWinstonOptions();
    const transports = Array.isArray(options.transports)
      ? options.transports
      : [options.transports];

    expect(transports).toHaveLength(3);

    const [consola] = [obtenerConsola(transports)];
    expect(consola).toBeDefined();

    const rutaCompleta = (r: DailyRotateFile): string => `${r.dirname}/${r.filename}`;
    const rotados = obtenerRotados(transports);
    const rotadoDeError = rotados.find((r) => rutaCompleta(r) === './logs/error-%DATE%.log');
    const rotadoDeAplicacion = rotados.find(
      (r) => rutaCompleta(r) === './logs/application-%DATE%.log',
    );

    expect(rotadoDeError?.level).toBe('error');
    expect(rotadoDeAplicacion).toBeDefined();
  });

  it('buildWinstonOptions no agrega por omision mas metadatos que service y hostname', () => {
    process.env.NODE_ENV = 'production';
    const options = buildWinstonOptions();

    expect(Object.keys(options.defaultMeta as Record<string, unknown>).sort()).toEqual([
      'hostname',
      'service',
    ]);
  });
});
