import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { PasswordService } from './password.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
  // Se exportan para que AuthModule (CP-04) los reutilice.
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
