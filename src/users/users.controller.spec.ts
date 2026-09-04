import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './enums/user-role.enum';
import { User } from './entities/user.entity';
import { UserDto } from './dto/user.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UserListItemDto } from './dto/user-list-item.dto';

type UsersServiceMock = jest.Mocked<Pick<UsersService, 'getProfile' | 'create' | 'list'>>;

describe('UsersController - GET /users/me', () => {
  let controller: UsersController;
  let usersService: UsersServiceMock;

  const now = new Date();

  // Fabrica en vez de `{ ...baseUser }`: esparcir una instancia tipada como clase
  // pierde el prototipo (regla no-misused-spread) y aqui solo queremos datos.
  const buildUser = (id: string): User => ({
    id,
    username: 'jdoe',
    name: 'Juan Doe',
    email: 'juan@example.com',
    password: 'hashed-pw',
    role: UserRole.USER,
    isActive: true,
    lastTokenIssuedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const baseUserDto: UserDto = {
    id: 'uuid-1',
    username: 'jdoe',
    name: 'Juan Doe',
    email: 'juan@example.com',
    role: UserRole.USER,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    usersService = {
      getProfile: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
    };

    // El guard real (JwtAuthGuard) se instancia aqui porque @UseGuards es de
    // clase; no se ejercita (eso es users.controller.guard.spec.ts y el Nivel
    // B), solo debe resolver por DI (feature #5).
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('getMe devuelve el DTO del usuario autenticado sin campo password', async () => {
    usersService.getProfile.mockResolvedValue(baseUserDto);

    const result = await controller.getMe(buildUser('uuid-1'));

    expect(usersService.getProfile).toHaveBeenCalledWith('uuid-1');
    expect(result).toEqual(baseUserDto);
    expect(result).not.toHaveProperty('password');
  });

  it('getMe propaga NotFoundException cuando el usuario no existe', async () => {
    usersService.getProfile.mockRejectedValue(new NotFoundException('Usuario no encontrado'));

    await expect(controller.getMe(buildUser('uuid-inexistente'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usersService.getProfile).toHaveBeenCalledWith('uuid-inexistente');
  });

  /**
   * Batería de la feature #6 (`refactor_buenas_practicas`, `red_modo: caracterizacion`):
   * `create` y `list` del controller no se ejercitaban. Fijan que el controller
   * delega y NO arma su propio envoltorio (acoplamiento 3: `ResponseInterceptor`
   * global ya lo hace).
   */
  it('create delega en UsersService.create y devuelve el UserDto sin envolverlo', async () => {
    const dto: CreateUserDto = {
      username: 'jdoe',
      name: 'Juan Doe',
      email: 'juan@example.com',
      password: 'secret123',
      role: UserRole.USER,
      active: true,
    };
    usersService.create.mockResolvedValue(baseUserDto);

    const result = await controller.create(dto);

    expect(usersService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(baseUserDto);
  });

  it('list delega en UsersService.list y devuelve el arreglo de UserListItemDto tal cual', async () => {
    const listado: UserListItemDto[] = [
      { username: 'jdoe', name: 'Juan Doe', role: UserRole.USER, isActive: true },
    ];
    usersService.list.mockResolvedValue(listado);

    const result = await controller.list();

    expect(usersService.list).toHaveBeenCalledWith();
    expect(result).toEqual(listado);
  });
});
