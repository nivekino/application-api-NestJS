import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Inject } from '@nestjs/common';
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
 * (Authorization), JWT_SECRET ni cadenas de conexión.
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

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let resource: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const obj = res as Record<string, unknown>;
        message = (typeof obj.message === 'string' ? obj.message : undefined) ?? exception.message;
        // Detalle de validación (errores de class-validator), sin datos sensibles.
        if (Array.isArray(obj.message)) {
          message = 'Validación fallida';
          resource = { errors: obj.message };
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: ErrorBody = {
      statusCode,
      message,
      resource,
      isError: true,
    };

    this.logger.error(`${request.method} ${request.url} -> ${statusCode}: ${message}`);

    response.status(statusCode).json(body);
  }
}
