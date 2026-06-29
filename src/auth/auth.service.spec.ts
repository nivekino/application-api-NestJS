import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from '../users/password.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let passwordService: jest.Mocked<Partial<PasswordService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  const baseUser: User = {
    id: 'uuid-1',
    username: 'jdoe',
    name: 'Juan Doe',
    email: 'juan@example.com',
    password: 'hashed-pw',
    role: UserRole.USER,
    isActive: true,
    lastTokenIssuedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByUsername: jest.fn(),
      updateLastTokenIssuedAt: jest.fn(),
    };
    passwordService = {
      compare: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('login exitoso firma el token y actualiza lastTokenIssuedAt', async () => {
    (usersService.findByUsername as jest.Mock).mockResolvedValue(baseUser);
    (passwordService.compare as jest.Mock).mockResolvedValue(true);
    (jwtService.sign as jest.Mock).mockReturnValue('signed.jwt.token');

    const result = await service.login({
      username: 'jdoe',
      password: 'secret123',
    });

    expect(result).toEqual({ token: 'signed.jwt.token' });

    // Se actualiza lastTokenIssuedAt con el mismo iat usado para firmar.
    expect(usersService.updateLastTokenIssuedAt).toHaveBeenCalledTimes(1);
    const updateCall = (usersService.updateLastTokenIssuedAt as jest.Mock).mock
      .calls[0];
    const signCall = (jwtService.sign as jest.Mock).mock.calls[0];
    expect(updateCall[0]).toBe('uuid-1');
    const issuedAt = updateCall[1] as number;
    expect(typeof issuedAt).toBe('number');
    expect(signCall[0]).toMatchObject({
      sub: 'uuid-1',
      username: 'jdoe',
      role: UserRole.USER,
      iat: issuedAt,
    });
    // Expiración de 8h.
    expect(signCall[1]).toMatchObject({ expiresIn: '8h' });
  });

  it('lanza 401 si el usuario no existe', async () => {
    (usersService.findByUsername as jest.Mock).mockResolvedValue(null);

    await expect(
      service.login({ username: 'noexiste', password: 'secret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.updateLastTokenIssuedAt).not.toHaveBeenCalled();
  });

  it('lanza 401 si la contraseña es incorrecta', async () => {
    (usersService.findByUsername as jest.Mock).mockResolvedValue(baseUser);
    (passwordService.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ username: 'jdoe', password: 'mala' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.updateLastTokenIssuedAt).not.toHaveBeenCalled();
  });
});
