import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import { ResponseInterceptor } from './response.interceptor';

/**
 * Prueba de caracterizacion (feature #2, criterio 2 / deuda D2 de la feature #1):
 * documenta el envoltorio global que hoy aplica `ResponseInterceptor` a toda
 * respuesta exitosa. No se levanta la app HTTP: se construye el `ExecutionContext`
 * minimo que el interceptor necesita (solo usa `switchToHttp().getResponse()`).
 */
describe('ResponseInterceptor', () => {
  it('envuelve una respuesta exitosa como { statusCode, message: "OK", resource, isError: false }, tomando el statusCode de la respuesta HTTP', async () => {
    const interceptor = new ResponseInterceptor<{ id: string }>();
    const resource = { id: 'uuid-1' };
    const httpResponse = { statusCode: 201 } as unknown as Response;
    const context = {
      switchToHttp: () => ({
        getResponse: () => httpResponse,
      }),
    } as unknown as ExecutionContext;
    const callHandler: CallHandler<{ id: string }> = {
      handle: () => of(resource),
    };

    const result = await lastValueFrom(interceptor.intercept(context, callHandler));

    expect(result).toEqual({
      statusCode: 201,
      message: 'OK',
      resource,
      isError: false,
    });
  });
});
