/**
 * Forma única del envoltorio estándar de la API: `{ statusCode, message,
 * resource?, isError }`. Antes del refactor, la misma forma estaba declarada
 * DOS veces, en dos archivos, con dos nombres distintos (`ApiResponse` en
 * `response.interceptor.ts` y `ErrorBody` en `http-exception.filter.ts`) y dos
 * tipos de `isError` (`boolean` y el literal `true`). `ResponseInterceptor`
 * la produce en el camino de éxito; `HttpExceptionFilter`, en el de error.
 */
export interface ApiResponse<T = unknown> {
  statusCode: number;
  message: string;
  resource?: T;
  isError: boolean;
}
