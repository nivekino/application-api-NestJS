import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Repository } from 'typeorm';
import type { ApiResponse } from '../src/common/interceptors/response.interceptor';
import type { User } from '../src/users/entities/user.entity';

/**
 * E2E del flujo de autenticación y usuarios (Nivel B del harness).
 *
 * REQUIERE una instancia de PostgreSQL accesible y las variables de entorno
 * (DB_*, JWT_SECRET) configuradas en `.env`. Si no hay BD disponible, la suite
 * se omite (skip) en lugar de fallar, para no bloquear CI sin Postgres.
 *
 * La suite es DETERMINISTA: en `beforeAll` siembra su propio usuario (con la
 * contraseña hasheada por el `PasswordService` real) y lo borra en `afterAll`.
 * Antes, el caso de login aceptaba 200 o 401 según hubiera semilla o no: un
 * `expect` condicional pasa por cualquiera de los dos caminos y no fija ningún
 * comportamiento (regla `jest/no-conditional-expect`).
 *
 * El AppModule y todo lo que evalúa TypeORM se cargan de forma DIFERIDA dentro de
 * `beforeAll`, y no con imports estáticos de valor arriba (los `import type` se
 * borran al compilar y no cuentan). ⚠️ No lo cambies a imports estáticos: la
 * ruta del skip no debe evaluar el módulo de la aplicación, o un runtime que no
 * cumpla los requisitos tumba la suite completa ANTES de que el skip pueda
 * actuar — con un error de carga, no con un skip limpio. Medido el 2026-08-31.
 *
 * Para ejecutarla con BD:
 *   1. Copia `.env.example` a `.env` y completa credenciales de un Postgres de prueba.
 *   2. `npm run test:e2e`
 */
const hasDbConfig =
  !!process.env.DB_HOST &&
  !!process.env.DB_NAME &&
  !!process.env.DB_USER &&
  !!process.env.JWT_SECRET;

const describeOrSkip = hasDbConfig ? describe : describe.skip;

describeOrSkip('Auth + Users (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  const suffix = Date.now();
  const credentials = {
    username: `e2e_${suffix}`,
    password: 'secret123',
  };

  beforeAll(async () => {
    // Carga diferida: la ruta del skip no debe evaluar el módulo de la aplicación.
    //
    // Se usa `require` tipado con `typeof import(...)` y no `await import(...)`:
    // bajo `moduleResolution: nodenext`, TypeScript le aplica a los import()
    // dinámicos las reglas de resolución ESM de Node, que exigen extensión
    // explícita (`.js`) — y esa extensión no existe en disco, así que rompería en
    // runtime. En cambio `require` es exactamente lo que ts-jest emite aquí, y el
    // `typeof import(...)` en posición de TIPO sí resuelve sin extensión, de modo
    // que no se pierde nada de tipado.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    const { ResponseInterceptor } =
      require('../src/common/interceptors/response.interceptor') as typeof import('../src/common/interceptors/response.interceptor');
    const { User: UserEntity } =
      require('../src/users/entities/user.entity') as typeof import('../src/users/entities/user.entity');
    const { UserRole } =
      require('../src/users/enums/user-role.enum') as typeof import('../src/users/enums/user-role.enum');
    const { PasswordService } =
      require('../src/users/password.service') as typeof import('../src/users/password.service');
    const { getRepositoryToken } = require('@nestjs/typeorm') as typeof import('@nestjs/typeorm');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    // Semilla propia de la suite: mismo hash que produce la API (bcrypt, salt 10).
    usersRepo = app.get<Repository<User>>(getRepositoryToken(UserEntity));
    const passwordService = app.get(PasswordService);
    await usersRepo.save(
      usersRepo.create({
        username: credentials.username,
        name: 'E2E User',
        email: `e2e_${suffix}@example.com`,
        password: await passwordService.hash(credentials.password),
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );
  });

  afterAll(async () => {
    // Criterio NO vacio a proposito: en TypeORM 1.x `delete({})` lanza.
    await usersRepo.delete({ username: credentials.username });
    await app.close();
  });

  it('GET /api/ responde que el servidor está arriba', async () => {
    const res = await request(app.getHttpServer()).get('/api/').expect(200);
    const body = res.body as ApiResponse<{ msg: string }>;
    expect(body.resource).toEqual({ msg: 'Server is up and running' });
    expect(body.isError).toBe(false);
  });

  it('POST /api/users sin token devuelve 401 con el formato estándar de error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        username: `otro_${suffix}`,
        name: 'E2E User',
        email: `otro_${suffix}@example.com`,
        password: credentials.password,
        role: 'admin',
        active: true,
      });
    const body = res.body as { statusCode: number; isError: boolean };
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ statusCode: 401, isError: true });
  });

  it('login con credenciales válidas devuelve { token } y permite listar usuarios', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(credentials);
    const body = login.body as ApiResponse<{ token: string }>;
    expect(login.status).toBe(200);
    expect(body.resource?.token).toEqual(expect.any(String));

    const list = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${body.resource?.token ?? ''}`);
    const listBody = list.body as ApiResponse<{ username: string }[]>;
    expect(list.status).toBe(200);
    expect(listBody.resource?.map((u) => u.username)).toContain(credentials.username);
  });

  it('login con contraseña incorrecta devuelve 401', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: credentials.username, password: 'incorrecta' });
    expect(login.status).toBe(401);
  });
});
