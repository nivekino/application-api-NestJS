import 'reflect-metadata';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Feature #5, criterio 2. Reproduce las DOS lecturas de metadatos que hace el
 * injector de NestJS (`node_modules/@nestjs/core/injector/injector.js`):
 * `design:paramtypes` se lee con `Reflect.getMetadata` (camina la cadena de
 * prototipos, así que hereda del mixin `AuthGuard('jwt')`) y
 * `optional:paramtypes` se lee con `Reflect.getOwnMetadata` (NO hereda). Una
 * dependencia opcional del mixin se vuelve obligatoria en la subclase si esta
 * no declara su propio constructor. Este test fija esa asimetría como
 * invariante: si `obligatorias` deja de ser `[]`, `JwtAuthGuard` vuelve a
 * exigir `AuthModuleOptions` en cualquier módulo que lo use.
 */
describe('JwtAuthGuard', () => {
  it('JwtAuthGuard no declara ninguna dependencia de constructor obligatoria: el injector de NestJS no le exige AuthModuleOptions', () => {
    const paramtypes = (Reflect.getMetadata('design:paramtypes', JwtAuthGuard) ?? []) as unknown[];
    const opcionales = (Reflect.getOwnMetadata('optional:paramtypes', JwtAuthGuard) ??
      []) as number[];
    const obligatorias = paramtypes.filter((_, i) => !opcionales.includes(i));

    expect(obligatorias).toEqual([]);
  });
});
