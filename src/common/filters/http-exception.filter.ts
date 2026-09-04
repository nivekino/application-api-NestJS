import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { APP_LOGGER } from '../logger/logger.tokens';
import { ApiResponse } from '../interfaces/api-response.interface';
import type { Request, Response } from 'express';

/**
 * Filtro global que estandariza los errores como
 * `{ statusCode, message, resource?, isError: true }` y los registra con el
 * logger de la app.
 *
 * Seguridad de datos: solo se registran método, ruta, status y mensaje. NUNCA se
 * loguea el cuerpo de la petición (puede contener contraseñas), cabeceras
 * (Authorization), JWT_SECRET ni cadenas de conexión. El mensaje interno de
 * una excepción no controlada (p. ej. un error del driver de PostgreSQL) va
 * únicamente al log (diagnóstico, queda en disco); al cliente se le devuelve
 * siempre el literal genérico.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(APP_LOGGER)
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, resource, mensajeInterno } =
      this.extraerDeHttpException(exception);

    const body: ApiResponse = {
      statusCode,
      message,
      resource,
      isError: true,
    };

    this.logger.error(`${request.method} ${request.url} -> ${statusCode}: ${mensajeInterno}`);

    response.status(statusCode).json(body);
  }

  /**
   * Tabla de decisión de tres ramas: `HttpException` (con cuerpo string,
   * arreglo de validación u objeto con `message`), `Error` no controlado
   * (su `message` real NUNCA sale por la respuesta, solo al logger) y
   * cualquier otro valor lanzado.
   */
  private extraerDeHttpException(exception: unknown): {
    statusCode: number;
    message: string;
    resource?: unknown;
    mensajeInterno: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { statusCode, message: res, mensajeInterno: res };
      }

      if (typeof res === 'object' && 'message' in res) {
        const { message: detalle } = res;
        if (Array.isArray(detalle)) {
          // Detalle de validación (errores de class-validator), sin datos sensibles.
          return {
            statusCode,
            message: 'Validación fallida',
            resource: { errors: detalle },
            mensajeInterno: 'Validación fallida',
          };
        }
        const message = typeof detalle === 'string' ? detalle : exception.message;
        return { statusCode, message, mensajeInterno: message };
      }

      return { statusCode, message: exception.message, mensajeInterno: exception.message };
    }

    if (exception instanceof Error) {
      // El message real del Error (p. ej. detalle del driver de PostgreSQL)
      // NUNCA sale por la respuesta: solo se registra en el log.
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        mensajeInterno: exception.message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      mensajeInterno: 'Internal server error',
    };
  }
}
