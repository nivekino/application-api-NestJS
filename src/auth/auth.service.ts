import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PasswordService } from '../users/password.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  iat: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async login(payload: AuthCredentialsDto): Promise<{ token: string }> {
    const user = await this.usersService.findByUsername(payload.username);
    if (!user) {
      throw new UnauthorizedException('Usuario incorrecto');
    }

    const isValid = await this.passwordService.compare(payload.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    const issuedAtSeconds = Math.floor(Date.now() / 1000);

    // Invalida cualquier token previo: los tokens con iat < lastTokenIssuedAt
    // serán rechazados por la JwtStrategy.
    await this.usersService.updateLastTokenIssuedAt(user.id, issuedAtSeconds);

    const token = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        iat: issuedAtSeconds,
      },
      { expiresIn: '8h' },
    );

    return { token };
  }
}
