import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { UserListItemDto } from './dto/user-list-item.dto';
import { User } from './entities/user.entity';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Devuelve el perfil del usuario autenticado (sin contraseña)' })
  @ApiResponse({ status: 200, type: UserDto, description: 'Perfil del usuario autenticado' })
  @ApiResponse({ status: 401, description: 'No autorizado: JWT ausente o inválido' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  getMe(@CurrentUser() user: User): Promise<UserDto> {
    return this.usersService.getProfile(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario' })
  @ApiResponse({ status: 201, type: UserDto, description: 'Usuario creado' })
  @ApiResponse({ status: 401, description: 'No autorizado: JWT ausente o inválido' })
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los usuarios (sin contraseñas)' })
  @ApiResponse({ status: 200, type: [UserListItemDto] })
  @ApiResponse({ status: 401, description: 'No autorizado: JWT ausente o inválido' })
  list(): Promise<UserListItemDto[]> {
    return this.usersService.list();
  }
}
