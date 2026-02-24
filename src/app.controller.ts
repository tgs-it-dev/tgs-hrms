import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  pid: number | undefined;
  memory: NodeJS.MemoryUsage;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      memory: process.memoryUsage(),
    };
  }
}
