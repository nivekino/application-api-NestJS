/**
 * Forma del payload del JWT emitido por `AuthService.login` y consumido por
 * `JwtStrategy.validate`. Vive en su propio archivo (convención de NestJS
 * para contratos compartidos dentro de un módulo): antes estaba declarado
 * dentro de `auth.service.ts`, así que `jwt.strategy.ts` importaba una
 * interfaz DESDE un servicio del que no depende.
 */
export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  iat: number;
}
