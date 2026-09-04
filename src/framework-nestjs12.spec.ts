import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';

/**
 * Feature #3 (migración a NestJS 12 ESM): test de plataforma, no de negocio.
 * Ancla en disco el criterio 1 de `acceptance` — que la app corre con todos
 * los `@nestjs/*` en la línea 12 — para que "migramos a NestJS 12" no sea una
 * afirmación que nadie vuelve a comprobar cuando alguien haga `npm i` de otra
 * cosa.
 *
 * La segunda mitad del criterio (que Jest, vía ts-jest en CommonJS, puede
 * resolver un `require(esm)` de `@nestjs/common` bajo `jest-runtime`) la
 * demuestra el archivo mismo: si `require(esm)` no funcionara, esta suite ni
 * siquiera cargaría.
 */
describe('Plataforma NestJS 12', () => {
  it('package.json declara todos los paquetes @nestjs en la linea 12 y un import estatico de @nestjs/common resuelve bajo Jest en CommonJS', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const todasLasDependencias = { ...pkg.dependencies, ...pkg.devDependencies };
    const paquetesNestjs = Object.entries(todasLasDependencias).filter(([nombre]) =>
      nombre.startsWith('@nestjs/'),
    );
    const desalineados = paquetesNestjs
      .filter(([, version]) => !/^\^?12\./.test(version))
      .map(([nombre, version]) => `${nombre}@${version}`);

    expect(desalineados).toEqual([]);
    expect(typeof Injectable).toBe('function');
  });
});
