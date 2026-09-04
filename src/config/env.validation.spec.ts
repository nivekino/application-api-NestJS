import 'reflect-metadata';
import { validateEnv, EnvironmentVariables } from './env.validation';

/**
 * Batería de la feature #5 (`arranque_real_port_y_guard_passport12`), criterio 1.
 *
 * Valores literales de prueba: ninguno es un secreto real, solo cumplen las
 * restricciones de `class-validator` para poder aislar el comportamiento de `PORT`
 * (y, como contraste, de `DB_PORT`, que sí convierte hoy).
 */
const base = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'u',
  DB_PASS: 'valor-de-prueba-no-es-un-secreto',
  DB_NAME: 'd',
  JWT_SECRET: 'valor-de-prueba-no-es-un-secreto',
};

describe('validateEnv', () => {
  it('validateEnv acepta PORT como cadena numerica del entorno ("3000") y lo entrega como number', () => {
    const config = validateEnv({ ...base, PORT: '3000' });

    expect(config.PORT).toBe(3000);
  });

  it('EnvironmentVariables declara PORT con anotacion de tipo: su design:type es Number, no Object', () => {
    const tipo = Reflect.getMetadata(
      'design:type',
      EnvironmentVariables.prototype,
      'PORT',
    ) as unknown;

    expect(tipo).toBe(Number);
  });

  it('validateEnv conserva el valor por omision 3000 cuando PORT no viene en el entorno', () => {
    const config = validateEnv({ ...base });

    expect(config.PORT).toBe(3000);
  });

  it('validateEnv rechaza un PORT no numerico', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('validateEnv rechaza un PORT fuera del rango 0-65535', () => {
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('el mensaje de error de validateEnv nombra la propiedad y la restriccion, nunca el valor recibido', () => {
    let mensaje = '';
    try {
      validateEnv({ ...base, PORT: '70000' });
    } catch (error) {
      mensaje = error instanceof Error ? error.message : '';
    }

    expect(mensaje).toContain('PORT');
    expect(mensaje).not.toContain('70000');
    expect(mensaje).not.toContain('valor-de-prueba-no-es-un-secreto');
  });

  it('validateEnv convierte DB_PORT recibido como cadena del entorno en number', () => {
    const config = validateEnv({ ...base, DB_PORT: '5432' });

    expect(config.DB_PORT).toBe(5432);
  });

  /**
   * Batería de la feature #6 (`refactor_buenas_practicas`, `red_modo: caracterizacion`):
   * `validateEnv` no tenía ninguna prueba hasta la feature #5 (T1-T7 de PORT). Estos
   * casos fijan el resto del comportamiento hoy existente, antes de refactorizar
   * `src/config/env.validation.ts`.
   */
  it('validateEnv devuelve una instancia de EnvironmentVariables con los valores del entorno convertidos a su tipo', () => {
    const config = validateEnv({ ...base });

    expect(config).toBeInstanceOf(EnvironmentVariables);
  });

  it('validateEnv aplica development como NODE_ENV cuando la variable no viene en el entorno', () => {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, JWT_SECRET } = base;

    const config = validateEnv({ DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, JWT_SECRET });

    expect(config.NODE_ENV).toBe('development');
  });

  it('validateEnv lanza un Error que nombra la propiedad y la restriccion cuando falta una variable obligatoria', () => {
    const { NODE_ENV, DB_PORT, DB_USER, DB_PASS, DB_NAME, JWT_SECRET } = base;

    expect(() => validateEnv({ NODE_ENV, DB_PORT, DB_USER, DB_PASS, DB_NAME, JWT_SECRET })).toThrow(
      /DB_HOST/,
    );
  });

  it('validateEnv no incluye el valor de JWT_SECRET ni de DB_PASS en el mensaje de error', () => {
    let mensaje = '';
    try {
      validateEnv({ ...base, DB_HOST: '' });
    } catch (error) {
      mensaje = error instanceof Error ? error.message : '';
    }

    expect(mensaje).toContain('DB_HOST');
    expect(mensaje).not.toContain(base.JWT_SECRET);
    expect(mensaje).not.toContain(base.DB_PASS);
  });

  it('validateEnv rechaza un NODE_ENV que no esta en el catalogo de entornos', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
