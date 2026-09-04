import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    // El constructor NO es decorativo: es lo que hace que TypeScript emita
    // `design:paramtypes: []` PROPIO de esta clase. Sin él, el injector de NestJS lee el
    // metadato heredado del mixin `AuthGuard()` con `Reflect.getMetadata` (camina la cadena de
    // prototipos) y ve una dependencia `AuthModuleOptions`, mientras que el `@Optional()` de ese
    // mismo mixin lo lee con `getOwnMetadata` y NO lo hereda: la dependencia opcional del padre se
    // vuelve OBLIGATORIA aquí y el módulo del controller que use este guard no arranca.
    // La estrategia es explícita ('jwt'), así que `defaultStrategy` solo documenta la intención:
    // `omitAuthModuleOptions()` lo descarta antes de llamar a passport.authenticate().
    super({ defaultStrategy: 'jwt' });
  }
}
