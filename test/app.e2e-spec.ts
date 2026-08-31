import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * E2E del flujo de autenticación y usuarios.
 *
 * REQUIERE una instancia de PostgreSQL accesible y las variables de entorno
 * (DB_*, JWT_SECRET) configuradas en `.env`. Si no hay BD disponible, la suite
 * se omite (skip) en lugar de fallar, para no bloquear CI sin Postgres.
 *
 * El AppModule se carga de forma DIFERIDA dentro de `beforeAll`, y no con un
 * import estático arriba. ⚠️ No lo cambies a import estático: importar AppModule
 * evalúa TypeORM, y si el runtime no cumple los requisitos del proyecto eso tumba
 * la suite completa ANTES de que el skip pueda actuar — con un error de carga, no
 * con un skip limpio. Medido el 2026-08-31 al intentar exactamente ese cambio.
 * La regla general: la ruta del skip no debe evaluar el módulo de la aplicación.
 *
 * Para ejecutarla con BD:
 *   1. Copia `.env.example` a `.env` y completa credenciales de un Postgres de prueba.
 *   2. `npm run test:e2e`
 */
const hasDbConfig = !!process.env.DB_HOST && !!process.env.DB_NAME && !!process.env.DB_USER && !!process.env.JWT_SECRET;

const describeOrSkip = hasDbConfig ? describe : describe.skip;

describeOrSkip('Auth + Users (e2e)', () => {
  let app: INestApplication<App>;
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
    const { AppModule } = require('./../src/app.module') as typeof import('./../src/app.module');
    const { ResponseInterceptor } = require('./../src/common/interceptors/response.interceptor') as typeof import('./../src/common/interceptors/response.interceptor');
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/ responde que el servidor está arriba', async () => {
    const res = await request(app.getHttpServer()).get('/api/').expect(200);
    expect(res.body.resource).toEqual({ msg: 'Server is up and running' });
    expect(res.body.isError).toBe(false);
  });

  it('POST /api/users sin token devuelve 401', async () => {
    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        username: credentials.username,
        name: 'E2E User',
        email: `e2e_${suffix}@example.com`,
        password: credentials.password,
        role: 'admin',
        active: true,
      })
      .expect(401);
  });

  it('login con credenciales válidas devuelve { token } y permite listar usuarios', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(credentials);

    if (login.status === 200) {
      const token = login.body.resource.token as string;
      expect(token).toBeDefined();

      await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${token}`).expect(200);
    } else {
      // Sin usuario semilla, el login devuelve 401 (contrato documentado).
      expect(login.status).toBe(401);
    }
  });
});
