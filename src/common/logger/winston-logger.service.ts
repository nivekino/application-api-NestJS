import { Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';

/**
 * Niveles que este servicio efectivamente emite. Sin este tipo, `nivel` era
 * `string`: un typo como `'infoo'` habría llegado hasta el archivo de log en
 * vez de fallar en el compilador.
 */
type NivelLog = 'info' | 'error' | 'warn' | 'debug' | 'verbose';

/**
 * Superficie mínima de winston que este servicio consume. Se declara aquí
 * (en vez de inyectar `winston.Logger` completo) para poder mockearla en los
 * specs con un solo método, sin depender de las sobrecargas del tipo real.
 */
export interface WinstonLike {
  log(level: NivelLog, message: string, meta?: Record<string, unknown>): unknown;
}

/**
 * `LoggerService` propio sobre `winston`. Reemplaza a `nest-winston` (sin
 * soporte para NestJS 12, peer `@nestjs/common ^5..^11`). La configuración de
 * transports, niveles y rotación sigue viviendo, sin cambios, en
 * `winston.config.ts`.
 *
 * Seguridad de datos: winston escribe a archivo rotado (queda en disco). Este
 * servicio NUNCA serializa un objeto arbitrario al log: solo adjunta como
 * metadato el `context` que NestJS pasa como string y, en `error`, el
 * `stack`. Un `JSON.stringify(message)` cómodo podría convertir cualquier
 * objeto de crédito o cobranza en una línea persistida.
 *
 * `setLogLevels` no se implementa a propósito: el nivel lo decide
 * `buildWinstonOptions()` a partir de `NODE_ENV`, en un solo lugar. Si
 * NestJS pudiera sobrescribirlo en runtime habría dos fuentes de verdad para
 * el mismo número.
 */
@Injectable()
export class WinstonLoggerService implements LoggerService {
  constructor(private readonly winston: WinstonLike) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.escribir('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.escribir('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.escribir('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.escribir('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.escribir('verbose', message, optionalParams);
  }

  /**
   * Los niveles `npm` de winston no tienen `fatal`. Se registra como
   * `error` con el metadato `{ fatal: true }` para no tocar `levels` en
   * `winston.config.ts` (archivo transversal) ni el parseo de logs
   * históricos.
   */
  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.escribir('error', message, optionalParams, { fatal: true });
  }

  /**
   * Un solo lugar donde se decide qué llega al metadato = un solo lugar que
   * auditar por datos sensibles.
   *
   * Regla de contexto/stack: NestJS invoca `log(message, context)` y
   * `error(message, stack, context)`. Si el último parámetro opcional es
   * `string`, es el `context`; en `error`, si además queda un parámetro
   * previo, es el `stack`. Sin parámetros opcionales, no se adjunta ningún
   * metadato.
   */
  private escribir(
    nivel: NivelLog,
    message: unknown,
    optionalParams: unknown[],
    metaExtra?: Record<string, unknown>,
  ): void {
    const params = [...optionalParams];
    const meta: Record<string, unknown> = {};

    if (params.length > 0 && typeof params[params.length - 1] === 'string') {
      meta.context = params.pop();
    }
    if (nivel === 'error' && params.length > 0 && typeof params[0] === 'string') {
      meta.stack = params[0];
    }
    if (metaExtra) {
      Object.assign(meta, metaExtra);
    }

    const texto = this.normalizarMensaje(message);

    if (Object.keys(meta).length > 0) {
      this.winston.log(nivel, texto, meta);
    } else {
      this.winston.log(nivel, texto);
    }
  }

  private normalizarMensaje(message: unknown): string {
    if (message instanceof Error) {
      return message.message;
    }
    return String(message);
  }
}
