import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Regla de invalidación de tokens: rechazar si el token fue emitido antes
    // del último login registrado. `lastTokenIssuedAt` es bigint -> el driver
    // pg lo devuelve como string, por eso se coerciona a Number.
    if (user.lastTokenIssuedAt !== null && user.lastTokenIssuedAt !== undefined) {
      const lastIssued = Number(user.lastTokenIssuedAt);
      if (payload.iat < lastIssued) {
        throw new UnauthorizedException();
      }
    }

    return user;
  }
}
