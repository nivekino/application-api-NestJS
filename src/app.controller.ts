import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { HealthDto } from './app/dto/health.dto';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica que el servidor esta arriba' })
  @ApiResponse({ status: 200, type: HealthDto })
  getHealth(): HealthDto {
    return this.appService.getHealth();
  }
}
