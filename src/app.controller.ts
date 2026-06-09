import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Lightweight liveness probe for the deploy platform (Render health check).
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
