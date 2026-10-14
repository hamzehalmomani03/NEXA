import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      success: true,
      message: 'NEXA API is running',
      version: '1.0.0',
    };
  }
}