import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

/**
 * Item de listado publico de usuarios. NO incluye `password` ni `email`.
 */
export class UserListItemDto {
  @ApiProperty()
  username!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  isActive!: boolean;
}
