import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * Envuelve las respuestas exitosas en el formato estandarizado
 * `{ statusCode, message, resource, isError: false }` (equivalente a
 * `http-response.ts` del origen).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((resource) => ({
        statusCode: response.statusCode,
        message: 'OK',
        resource,
        isError: false,
      })),
    );
  }
}
