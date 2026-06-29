import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { msg: string } {
    return { msg: 'Server is up and running' };
  }
}
