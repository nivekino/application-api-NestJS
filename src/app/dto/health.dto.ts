import { ApiProperty } from '@nestjs/swagger';

/**
 * Respuesta de `GET /api/`. El literal `'Server is up and running'` no
 * cambia; este DTO solo publica el schema en Swagger, que antes del refactor
 * quedaba como un tipo inline `{ msg: string }` duplicado en el controller y
 * en el servicio.
 */
export class HealthDto {
  @ApiProperty()
  msg!: string;
}
