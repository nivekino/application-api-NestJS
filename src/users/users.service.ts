import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PasswordService } from './password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { UserListItemDto } from './dto/user-list-item.dto';

// TypeORM 1.x: `select` es un objeto tipado por columna (string[] ya no
// compila). Una sola constante para la lista de columnas públicas: `list()`
// la usa como criterio de la consulta y `toListItemDto` la usa como forma del
// mapeo, así que ambas listas no pueden desincronizarse entre sí.
const SELECT_PUBLICO = { username: true, name: true, role: true, isActive: true } as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(payload: CreateUserDto): Promise<UserDto> {
    const hashedPassword = await this.passwordService.hash(payload.password);

    const user = this.userRepository.create({
      username: payload.username,
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      role: payload.role,
      isActive: payload.active ?? true,
    });

    const created = await this.userRepository.save(user);

    return this.toDto(created);
  }

  async list(): Promise<UserListItemDto[]> {
    const users = await this.userRepository.find({ select: SELECT_PUBLICO });

    return users.map((u) => this.toListItemDto(u));
  }

  async getProfile(id: string): Promise<UserDto> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toDto(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async updateLastTokenIssuedAt(id: string, issuedAtSeconds: number): Promise<void> {
    await this.userRepository.update(id, {
      lastTokenIssuedAt: issuedAtSeconds,
    });
  }

  private toDto(u: User): UserDto {
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  private toListItemDto(u: User): UserListItemDto {
    return {
      username: u.username,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
    };
  }
}
