import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from '../users/password.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

// Mocks tipados: cada metodo conserva la firma real, asi que `mockResolvedValue`
// y `mock.calls` quedan verificados por el compilador (nada de `as jest.Mock`).
type UsersServiceMock = jest.Mocked<
  Pick<UsersService, 'findByUsername' | 'updateLastTokenIssuedAt'>
>;
type PasswordServiceMock = jest.Mocked<Pick<PasswordService, 'compare'>>;
type JwtServiceMock = jest.Mocked<Pick<JwtService, 'sign'>>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersServiceMock;
  let passwordService: PasswordServiceMock;
  let jwtService: JwtServiceMock;

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

    service = module.get(AuthService);
  });

  it('login exitoso firma el token y actualiza lastTokenIssuedAt', async () => {
    usersService.findByUsername.mockResolvedValue(baseUser);
    passwordService.compare.mockResolvedValue(true);
    jwtService.sign.mockReturnValue('signed.jwt.token');

    const result = await service.login({
      username: 'jdoe',
      password: 'secret123',
    });

    expect(result).toEqual({ token: 'signed.jwt.token' });

    // Se actualiza lastTokenIssuedAt con el MISMO iat usado para firmar: si
    // difirieran, el token recien emitido naceria invalidado (o no invalidaria
    // a los anteriores).
    expect(usersService.updateLastTokenIssuedAt).toHaveBeenCalledTimes(1);
    const [updatedId, issuedAt] = usersService.updateLastTokenIssuedAt.mock.lastCall ?? [];
    expect(updatedId).toBe('uuid-1');
    expect(issuedAt).toEqual(expect.any(Number));
    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'uuid-1',
        username: 'jdoe',
        role: UserRole.USER,
        iat: issuedAt,
      },
      // Expiración de 8h.
      { expiresIn: '8h' },
    );
  });

  it('lanza 401 si el usuario no existe', async () => {
    usersService.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({ username: 'noexiste', password: 'secret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.updateLastTokenIssuedAt).not.toHaveBeenCalled();
  });

  it('lanza 401 si la contraseña es incorrecta', async () => {
    usersService.findByUsername.mockResolvedValue(baseUser);
    passwordService.compare.mockResolvedValue(false);

    await expect(service.login({ username: 'jdoe', password: 'mala' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.updateLastTokenIssuedAt).not.toHaveBeenCalled();
  });
});
