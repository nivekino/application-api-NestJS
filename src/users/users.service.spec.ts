import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { PasswordService } from './password.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';

type RepositoryMock = jest.Mocked<
  Pick<Repository<User>, 'create' | 'save' | 'find' | 'findOne' | 'update'>
>;
type PasswordServiceMock = jest.Mocked<Pick<PasswordService, 'hash' | 'compare'>>;

describe('UsersService', () => {
  let service: UsersService;
  let repo: RepositoryMock;
  let passwordService: PasswordServiceMock;

  const now = new Date();
  const buildUser = (overrides: Partial<User> = {}): User => ({
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
    ...overrides,
  });

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
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get(UsersService);
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

    passwordService.hash.mockResolvedValue('hashed-pw');

    const persisted = buildUser();
    repo.create.mockReturnValue(persisted);
    repo.save.mockResolvedValue(persisted);

    const result = await service.create(dto);

    expect(passwordService.hash).toHaveBeenCalledWith('secret123');
    // El password hasheado se persiste, pero NO se expone en el DTO.
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed-pw' }));
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
    expect(result).not.toHaveProperty('password');
  });

  it('list devuelve solo campos públicos (sin password ni email)', async () => {
    repo.find.mockResolvedValue([buildUser()]);

    const result = await service.list();

    // TypeORM 1.x: `select` es un objeto por columna; la consulta pide solo lo publico.
    expect(repo.find).toHaveBeenCalledWith({
      select: { username: true, name: true, role: true, isActive: true },
    });
    expect(result).toEqual([
      { username: 'jdoe', name: 'Juan Doe', role: UserRole.USER, isActive: true },
    ]);
    expect(result[0]).not.toHaveProperty('password');
    expect(result[0]).not.toHaveProperty('email');
  });

  describe('getProfile', () => {
    it('devuelve UserDto sin password cuando el usuario existe', async () => {
      repo.findOne.mockResolvedValue(buildUser());

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
      expect(result).not.toHaveProperty('password');
    });

    it('lanza NotFoundException cuando el usuario no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('uuid-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-inexistente' } });
    });
  });

  /**
   * Batería de la feature #6 (`refactor_buenas_practicas`, `red_modo: caracterizacion`):
   * `findByUsername` y `updateLastTokenIssuedAt` no tenían prueba directa (solo se
   * ejercitaban indirectamente vía `AuthService`). Fijan comportamiento hoy existente
   * antes del refactor R10 (constante del `select` público + `toListItemDto`).
   */
  it('findByUsername consulta por la columna username y devuelve la entidad completa, porque el login necesita el hash', async () => {
    const persisted = buildUser();
    repo.findOne.mockResolvedValue(persisted);

    const result = await service.findByUsername('jdoe');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { username: 'jdoe' } });
    expect(result).toEqual(persisted);
  });

  it('findById devuelve la entidad completa, incluido lastTokenIssuedAt, que la regla de invalidacion de JWT necesita', async () => {
    const persisted = buildUser({ lastTokenIssuedAt: 2000 });
    repo.findOne.mockResolvedValue(persisted);

    const result = await service.findById('uuid-1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    expect(result?.lastTokenIssuedAt).toBe(2000);
  });

  it('updateLastTokenIssuedAt actualiza solo esa columna usando el id del usuario como criterio no vacio', async () => {
    repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

    await service.updateLastTokenIssuedAt('uuid-1', 12345);

    expect(repo.update).toHaveBeenCalledWith('uuid-1', { lastTokenIssuedAt: 12345 });
  });

  it('create marca isActive en true cuando el DTO no trae el campo active', async () => {
    const dto: CreateUserDto = {
      username: 'jdoe',
      name: 'Juan Doe',
      email: 'juan@example.com',
      password: 'secret123',
      role: UserRole.USER,
    };

    passwordService.hash.mockResolvedValue('hashed-pw');
    const persisted = buildUser();
    repo.create.mockReturnValue(persisted);
    repo.save.mockResolvedValue(persisted);

    await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });
});
