import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { UsersModule } from './users.module';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type UserRepositoryDouble = jest.Mocked<Pick<Repository<User>, 'find' | 'findOne'>>;

/**
 * Feature #5, criterio 2. Precedente a espejar:
 * `src/common/logger/logger.module.spec.ts` — el único test de la batería que
 * atrapa el modo de falla real: una dependencia sin resolver que solo aparece
 * al levantar la app. Aquí se compila `UsersModule` REAL, sin `overrideGuard`:
 * si `JwtAuthGuard` vuelve a exigir `AuthModuleOptions` por constructor, este
 * test cae con el mismo error de DI que tumbó el Nivel B (B2 de la feature #3).
 */
describe('UsersModule', () => {
  it('UsersModule compila sin overrideGuard y JwtAuthGuard resuelve sus dependencias bajo @nestjs/passport 12', async () => {
    const repositorioDoble: UserRepositoryDouble = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
      .overrideProvider(getRepositoryToken(User))
      .useValue(repositorioDoble)
      .compile();

    expect(moduleRef.get(UsersController)).toBeInstanceOf(UsersController);
    expect(moduleRef.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
  });
});
