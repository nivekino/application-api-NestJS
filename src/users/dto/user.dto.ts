import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

/**
 * Respuesta completa de un usuario. NO incluye `password`.
 */
export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
