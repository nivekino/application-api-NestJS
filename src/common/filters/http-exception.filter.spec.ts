import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost, LoggerService } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

type LoggerMock = jest.Mocked<Pick<LoggerService, 'log' | 'error' | 'warn'>>;

/**
 * Prueba de caracterizacion (feature #2, criterios 3 y 4 / deuda D2 de la
 * feature #1): documenta la forma del error que hoy produce el
 * `HttpExceptionFilter` global y lo que registra en el logger.
 *
 * Seguridad Kata: uno de los escenarios incluye una contraseña en el cuerpo de
 * la peticion para comprobar que el logger NUNCA la registra (solo metodo,
 * ruta, status y mensaje).
 */
describe('HttpExceptionFilter', () => {
  let logger: LoggerMock;
  let filter: HttpExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    filter = new HttpExceptionFilter(logger);
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
  });

  const construirHost = (
    request: Pick<Request, 'method' | 'url'> & { body?: unknown },
  ): ArgumentsHost => {
    const response = { status } as unknown as Response;
    return {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request as unknown as Request,
      }),
    } as unknown as ArgumentsHost;
  };

  it('HttpExceptionFilter serializa una HttpException como { statusCode, message, isError: true }', () => {
    const host = construirHost({ method: 'GET', url: '/api/users/me' });

    filter.catch(new NotFoundException('Usuario no encontrado'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Usuario no encontrado',
      resource: undefined,
      isError: true,
    });
  });

  it('HttpExceptionFilter convierte los errores de validación de class-validator en message "Validación fallida" con resource.errors', () => {
    const host = construirHost({ method: 'POST', url: '/api/users' });
    const erroresDeValidacion = [
      'el campo email debe ser un correo válido',
      'el campo username es obligatorio',
    ];

    filter.catch(new BadRequestException(erroresDeValidacion), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Validación fallida',
      resource: { errors: erroresDeValidacion },
      isError: true,
    });
  });

  it('HttpExceptionFilter convierte una excepción no HTTP en 500 "Internal server error" y registra solo método, ruta, status y mensaje (nunca el cuerpo de la petición)', () => {
    const cuerpoSensible = { username: 'jdoe', password: 'Sup3rSecreta!' };
    const host = construirHost({ method: 'POST', url: '/api/users', body: cuerpoSensible });

    filter.catch('fallo inesperado sin forma de HttpException ni Error', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      resource: undefined,
      isError: true,
    });
    expect(logger.error).toHaveBeenCalledWith('POST /api/users -> 500: Internal server error');
    expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Sup3rSecreta!'));
  });
});
