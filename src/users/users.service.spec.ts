import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { PasswordService } from './password.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Partial<Repository<User>>>;
  let passwordService: jest.Mocked<Partial<PasswordService>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    passwordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repo }, { provide: PasswordService, useValue: passwordService }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('create hashea la contraseña y devuelve un DTO sin password', async () => {
    const dto: CreateUserDto = {
      username: 'jdoe',
      name: 'Juan Doe',
      email: 'juan@example.com',
      password: 'secret123',
      role: UserRole.USER,
      active: true,
    };

    (passwordService.hash as jest.Mock).mockResolvedValue('hashed-pw');

    const now = new Date();
    const persisted: User = {
      id: 'uuid-1',
      username: dto.username,
      name: dto.name,
      email: dto.email,
      password: 'hashed-pw',
      role: UserRole.USER,
      isActive: true,
      lastTokenIssuedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    (repo.create as jest.Mock).mockReturnValue(persisted);
    (repo.save as jest.Mock).mockResolvedValue(persisted);

    const result = await service.create(dto);

    expect(passwordService.hash).toHaveBeenCalledWith('secret123');
    // El password hasheado se persiste, pero NO se expone en el DTO.
    expect((repo.create as jest.Mock).mock.calls[0][0]).toMatchObject({
      password: 'hashed-pw',
    });
    expect(result).toEqual({
      id: 'uuid-1',
      username: 'jdoe',
      name: 'Juan Doe',
      email: 'juan@example.com',
      role: UserRole.USER,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(result as Record<string, unknown>).not.toHaveProperty('password');
  });

  it('list devuelve solo campos públicos (sin password ni email)', async () => {
    (repo.find as jest.Mock).mockResolvedValue([
      {
        username: 'jdoe',
        name: 'Juan Doe',
        role: UserRole.USER,
        isActive: true,
      },
    ]);

    const result = await service.list();

    expect(result).toEqual([{ username: 'jdoe', name: 'Juan Doe', role: UserRole.USER, isActive: true }]);
    expect(result[0] as Record<string, unknown>).not.toHaveProperty('password');
    expect(result[0] as Record<string, unknown>).not.toHaveProperty('email');
  });

  describe('getProfile', () => {
    const now = new Date();
    const persistedUser: User = {
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

    it('devuelve UserDto sin password cuando el usuario existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(persistedUser);

      const result = await service.getProfile('uuid-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
      expect(result).toEqual({
        id: 'uuid-1',
        username: 'jdoe',
        name: 'Juan Doe',
        email: 'juan@example.com',
        role: UserRole.USER,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      expect(result as Record<string, unknown>).not.toHaveProperty('password');
    });

    it('lanza NotFoundException cuando el usuario no existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('uuid-inexistente')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-inexistente' } });
    });
  });
});
