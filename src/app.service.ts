import { Injectable } from '@nestjs/common';
import { HealthDto } from './app/dto/health.dto';

@Injectable()
export class AppService {
  getHealth(): HealthDto {
    return { msg: 'Server is up and running' };
  }
}
