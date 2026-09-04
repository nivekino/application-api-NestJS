/**
 * Token de inyección del logger de la aplicación.
 *
 * Se usa un token propio (string) en vez de inyectar directamente la clase
 * `WinstonLoggerService` para que los consumidores (p. ej.
 * `HttpExceptionFilter`) puedan seguir tipando su dependencia como la
 * interfaz `LoggerService` de `@nestjs/common`, y para que sus specs puedan
 * mockearla con un `Pick<LoggerService, ...>` sin acoplarse a la
 * implementación concreta de Winston.
 */
export const APP_LOGGER = 'APP_LOGGER';
