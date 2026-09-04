import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../../users/entities/user.entity';

/**
 * Request ya autenticado por `JwtAuthGuard`: `JwtStrategy.validate()` puebla
 * `req.user` con la entidad `User` completa antes de que el handler se
 * ejecute, así que nunca llega `undefined` en este punto. `@types/passport`
 * declara `Request.user` como `Express.User | undefined` (interfaz vacía);
 * esta interfaz lo estrecha para los handlers protegidos, sin `any` ni
 * `eslint-disable`.
 */
export interface AuthenticatedRequest extends Request {
  user: User;
}

/**
 * Extrae el usuario autenticado del request. Reemplaza
 * `@Request() req: { user: User }`: el controller deja de conocer la forma
 * del `Request` de Express.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
