import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../enums/user-role.enum';

/**
 * Entidad User (TypeORM/PostgreSQL). Porta el modelo Mongoose del origen:
 * username y email unicos, role enum, isActive, lastTokenIssuedAt (clave para
 * la invalidacion de JWT) y timestamps automaticos.
 */
@Entity({ name: 'users' })
@Unique('UQ_users_username', ['username'])
@Unique('UQ_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  username!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  password!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Marca (segundos Unix) del ultimo token emitido. Los tokens con
   * `iat < lastTokenIssuedAt` se consideran invalidos. Nullable por defecto.
   */
  @Column({ type: 'bigint', nullable: true, default: null })
  lastTokenIssuedAt!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
