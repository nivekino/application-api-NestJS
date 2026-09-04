import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { JwtPayload } from '../auth.service';

type UsersServiceMock = jest.Mocked<Pick<UsersService, 'findById'>>;

describe('JwtStrategy (regla de invalidación de tokens)', () => {
  let strategy: JwtStrategy;
  let usersService: UsersServiceMock;

  const buildUser = (lastTokenIssuedAt: User['lastTokenIssuedAt']): User => ({
    id: 'uuid-1',
    username: 'jdoe',
    name: 'Juan Doe',
    email: 'juan@example.com',
    password: 'hashed-pw',
    role: UserRole.USER,
    isActive: true,
    lastTokenIssuedAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const payload = (iat: number): JwtPayload => ({
    sub: 'uuid-1',
    username: 'jdoe',
    role: UserRole.USER,
    iat,
  });

  beforeEach(() => {
    usersService = { findById: jest.fn() };
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    strategy = new JwtStrategy(config, usersService as unknown as UsersService);
  });

  it('rechaza el token si el usuario no existe', async () => {
    usersService.findById.mockResolvedValue(null);
    await expect(strategy.validate(payload(1000))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acepta el token si iat >= lastTokenIssuedAt', async () => {
    usersService.findById.mockResolvedValue(buildUser(1000));
    await expect(strategy.validate(payload(1000))).resolves.toMatchObject({
      id: 'uuid-1',
    });
  });

  it('rechaza el token previo si iat < lastTokenIssuedAt (re-login)', async () => {
    usersService.findById.mockResolvedValue(buildUser(2000));
    await expect(strategy.validate(payload(1000))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acepta el token si lastTokenIssuedAt es null', async () => {
    usersService.findById.mockResolvedValue(buildUser(null));
    await expect(strategy.validate(payload(1000))).resolves.toMatchObject({
      id: 'uuid-1',
    });
  });

  it('coerce bigint-string de pg al comparar', async () => {
    // El driver pg devuelve bigint como string; la entidad lo declara asi.
    usersService.findById.mockResolvedValue(buildUser('2000'));
    await expect(strategy.validate(payload(1000))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
