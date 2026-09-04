import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UsersController } from './users.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Prueba de caracterizacion (feature #2, criterio 1 / deuda D1 de la feature #1):
 * documenta que `UsersController` ya declara `JwtAuthGuard` como guard DE CLASE
 * (via `@UseGuards(JwtAuthGuard)` sobre el controller), y por eso TODAS sus rutas
 * -incluida GET /api/users/me- exigen JWT valido y responden 401 sin el.
 *
 * No se levanta el modulo HTTP completo: el metadato de guards de NestJS
 * (`GUARDS_METADATA` = '__guards__') se define en la clase al aplicar el
 * decorador, y es lo que `JwtAuthGuard` (un `AuthGuard('jwt')` de Passport)
 * usa para bloquear la peticion antes de que el controller la reciba.
 */
describe('UsersController - guard de clase (D1)', () => {
  it('UsersController declara JwtAuthGuard como guard de clase, de modo que GET /api/users/me responde 401 sin JWT valido', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, UsersController) ?? []) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });
});
