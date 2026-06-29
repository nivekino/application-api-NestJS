import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hash produce un hash bcrypt distinto del texto plano', async () => {
    const plain = 'secret123';
    const hash = await service.hash(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toEqual(plain);
    // Prefijo típico de bcrypt.
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('compare devuelve true para la contraseña correcta', async () => {
    const plain = 'secret123';
    const hash = await service.hash(plain);

    await expect(service.compare(plain, hash)).resolves.toBe(true);
  });

  it('compare devuelve false para una contraseña incorrecta', async () => {
    const hash = await service.hash('secret123');

    await expect(service.compare('otra-clave', hash)).resolves.toBe(false);
  });
});
