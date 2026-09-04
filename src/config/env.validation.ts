import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Esquema tipado de variables de entorno. Reemplaza al `config.ts` manual del
 * origen Express. Las cadenas sensibles (JWT_SECRET, DB_PASS) nunca se registran
 * en logs ni se exponen en respuestas.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  // La anotacion ": number" es load-bearing, no estilo: con emitDecoratorMetadata,
  // TypeScript emite design:type a partir de la anotacion; sin ella emite Object y
  // plainToInstance(..., { enableImplicitConversion: true }) no tiene a que convertir,
  // asi que la cadena '3000' que SIEMPRE entrega el entorno llega intacta a
  // @IsInt/@Min/@Max y la validacion la rechaza (mismo patron que DB_PORT!: number).
  // "readonly" es obligatorio (y no solo declarativo): @typescript-eslint/no-inferrable-types
  // trae autofix que BORRA la anotacion de tipo cuando puede inferirse del valor por
  // omision, y el hook PostToolUse corre `eslint --fix` en cada guardado; la regla salta
  // las propiedades readonly, asi que sin esta palabra el propio tooling del repo
  // reintroduce el defecto en silencio en el siguiente guardado.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  readonly PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASS!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    // Se reportan solo las propiedades y restricciones que fallaron, nunca los
    // valores (para no filtrar secretos como JWT_SECRET o DB_PASS).
    const detail = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Validacion de variables de entorno fallida -> ${detail}`);
  }

  return validatedConfig;
}
