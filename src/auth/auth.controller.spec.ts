import 'reflect-metadata';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type AuthServiceMock = jest.Mocked<Pick<AuthService, 'login'>>;

/**
 * Prueba de caracterización (feature #6 `refactor_buenas_practicas`,
 * `red_modo: caracterizacion`): `AuthController` no tenía spec propio. Fija el
 * comportamiento hoy existente antes de tocar `auth.service.ts`/`auth.controller.ts`
 * (R1-R4 del diseño): el controller no envuelve la respuesta (el envoltorio lo
 * aplica `ResponseInterceptor` global) y el login queda público, con 200 en vez
 * del 201 por omisión de `@Post`.
 */
describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthServiceMock;

  beforeEach(() => {
    authService = { login: jest.fn() };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('login delega en AuthService y devuelve el token sin envolverlo, porque el envoltorio lo aplica el ResponseInterceptor', async () => {
    authService.login.mockResolvedValue({ token: 'signed.jwt.token' });

    const result = await controller.login({ username: 'jdoe', password: 'secret123' });

    expect(result).toEqual({ token: 'signed.jwt.token' });
  });

  it('AuthController declara HttpCode 200 en POST /auth/login y no el 201 por omision de @Post', () => {
    // Object.getOwnPropertyDescriptor (no `AuthController.prototype.login` directo)
    // para no disparar jest/unbound-method: el metadato de @HttpCode se define
    // sobre la funcion del metodo (descriptor.value), no sobre la clase.
    const descriptor = Object.getOwnPropertyDescriptor(AuthController.prototype, 'login');
    const metodo = descriptor?.value as object;
    const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, metodo) as unknown;

    expect(httpCode).toBe(200);
  });

  it('AuthController no declara guard de clase: POST /auth/login queda publico', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, AuthController) ?? []) as unknown[];

    expect(guards).toEqual([]);
  });
});
