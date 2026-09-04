import { ApiProperty } from '@nestjs/swagger';

/**
 * Respuesta de `POST /api/auth/login`. Antes del refactor, el 200 de login no
 * publicaba schema en Swagger (a diferencia de `UsersController`, que sí
 * declara `type: UserDto`). El cable no cambia: sigue siendo `{ token }`.
 */
export class AuthResponseDto {
  @ApiProperty()
  token!: string;
}
