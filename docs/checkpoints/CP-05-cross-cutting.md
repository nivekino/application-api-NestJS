# CP-05 — Cross-cutting: respuestas, errores y logging

**Estado:** Hecho · **Depende de:** CP-04

## Objetivo
Estandarizar las respuestas y errores de la API, y portar el logging de Winston. Replica el
comportamiento de `http-response.ts` y `logger.ts` del origen.

## Tareas
1. `common/interceptors/response.interceptor.ts`: envolver respuestas exitosas en
   `{ statusCode, message, resource, isError: false }`. Registrar como interceptor global.
2. `common/filters/http-exception.filter.ts`: `@Catch()` global que devuelva
   `{ statusCode, message, resource?, isError: true }` y registre el error con el logger
   (sin filtrar datos sensibles).
3. Logging con `nest-winston`: configurar `WinstonModule` como logger de la app, con transports
   equivalentes (consola coloreada + rotación diaria de archivos de error y de aplicación).
   `level` según `NODE_ENV` (`debug` en dev, `info` en prod).
4. Conectar filtro/interceptor/logger globales en `main.ts` (o vía `APP_FILTER`/`APP_INTERCEPTOR`).

## Archivos a tocar
- `src/common/interceptors/response.interceptor.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/logger/winston.config.ts`
- `src/main.ts` / `src/app.module.ts`

## Criterios de aceptación
- [ ] `npm run build` compila sin errores.
- [ ] Respuestas exitosas siguen el formato `{ statusCode, message, resource, isError: false }`.
- [ ] Errores siguen `{ statusCode, message, isError: true }` y quedan registrados en logs.
- [ ] Los logs **no** contienen contraseñas, `JWT_SECRET` ni cadenas de conexión.

## Notas de ejecución

**Archivos creados/modificados:**
- `src/common/interceptors/response.interceptor.ts` — envuelve respuestas exitosas en `{ statusCode, message, resource, isError: false }`. Registrado global vía `APP_INTERCEPTOR`.
- `src/common/filters/http-exception.filter.ts` — `@Catch()` global → `{ statusCode, message, resource?, isError: true }`. Mapea `HttpException` (incluye detalle de validación de class-validator) y errores genéricos a 500. Loguea solo `método ruta -> status: mensaje` con el logger Winston. Registrado global vía `APP_FILTER`.
- `src/common/logger/winston.config.ts` — `buildWinstonOptions()` con consola coloreada + rotación diaria (`error-%DATE%.log` 30d, `application-%DATE%.log` 14d), `level` por `NODE_ENV`. Equivalente a `logger.ts` del origen.
- `src/app.module.ts` — `WinstonModule.forRoot(...)`, providers `APP_INTERCEPTOR` y `APP_FILTER`.
- `src/main.ts` — `bufferLogs: true` + `app.useLogger(WINSTON_MODULE_NEST_PROVIDER)`.
- `src/app.controller.ts` / `src/app.service.ts` — health `GET /api/` devuelve `{ msg: 'Server is up and running' }` (igual al origen), ahora envuelto por el interceptor.

**Dependencia añadida:** `winston-daily-rotate-file` (no estaba en la lista de CP-00 pero es necesaria para la rotación diaria del origen).

**Resultado del build/lint:** `npm run build` compila sin errores. `npm run lint` deja limpios todos los archivos de la migración (Prettier reformateó). El único error de lint pendiente estaba en `app.controller.spec.ts` (scaffold viejo) y se reescribe en CP-06.

**Seguridad Kata:**
- El filtro NUNCA loguea el body de la petición, cabeceras (`Authorization`) ni el stack con datos sensibles; solo método, ruta, status y mensaje.
- La validación de env reporta propiedad+restricción, nunca el valor del secreto.
- Winston solo serializa los metadatos que se le pasan explícitamente; no hay transports que vuelquen `process.env` ni la cadena de conexión.
