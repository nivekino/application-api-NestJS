import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  resource?: unknown;
  isError: true;
}

/**
 * Filtro global que estandariza los errores como
 * `{ statusCode, message, resource?, isError: true }` y los registra con el
 * logger de la app.
 *
 * Seguridad Kata: solo se registran método, ruta, status y mensaje. NUNCA se
 * loguea el cuerpo de la petición (puede contener contraseñas), cabeceras
 * (Authorization), JWT_SECRET ni cadenas de conexión. El mensaje interno de
 * una excepción no controlada (p. ej. un error del driver de PostgreSQL) va
 * únicamente al log (diagnóstico, queda en disco); al cliente se le devuelve
 * siempre el literal genérico.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let resource: unknown;
    let mensajeInterno = message;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const obj = res as Record<string, unknown>;
        message = (typeof obj.message === 'string' ? obj.message : undefined) ?? exception.message;
        // Detalle de validación (errores de class-validator), sin datos sensibles.
        if (Array.isArray(obj.message)) {
          message = 'Validación fallida';
          resource = { errors: obj.message };
        }
      }
      mensajeInterno = message;
    } else if (exception instanceof Error) {
      // El message real del Error (p. ej. detalle del driver de PostgreSQL)
      // NUNCA sale por la respuesta: solo se registra en el log.
      mensajeInterno = exception.message;
    }

    const body: ErrorBody = {
      statusCode,
      message,
      resource,
      isError: true,
    };

    this.logger.error(`${request.method} ${request.url} -> ${statusCode}: ${mensajeInterno}`);

    response.status(statusCode).json(body);
  }
}
