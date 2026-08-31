import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './enums/user-role.enum';
import { User } from './entities/user.entity';
import { UserDto } from './dto/user.dto';

describe('UsersController - GET /users/me', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const now = new Date();

  const baseUser: User = {
    id: 'uuid-1',
    username: 'jdoe',
    name: 'Juan Doe',
    email: 'juan@example.com',
    password: 'hashed-pw',
    role: UserRole.USER,
    isActive: true,
    lastTokenIssuedAt: null,
    createdAt: now,
    updatedAt: now,
  };

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('getMe devuelve el DTO del usuario autenticado sin campo password', async () => {
    (usersService.getProfile as jest.Mock).mockResolvedValue(baseUserDto);

    const req = { user: baseUser };
    const result = await controller.getMe(req);

    expect(usersService.getProfile).toHaveBeenCalledWith('uuid-1');
    expect(result).toEqual(baseUserDto);
    expect(result).not.toHaveProperty('password');
  });

  it('getMe propaga NotFoundException cuando el usuario no existe', async () => {
    (usersService.getProfile as jest.Mock).mockRejectedValue(new NotFoundException('Usuario no encontrado'));

    const req = { user: { ...baseUser, id: 'uuid-inexistente' } };

    await expect(controller.getMe(req)).rejects.toBeInstanceOf(NotFoundException);
    expect(usersService.getProfile).toHaveBeenCalledWith('uuid-inexistente');
  });
});
