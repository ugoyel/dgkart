import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from './common/roles';

@ApiTags('health')
@Public()
@Controller()
export class AppController {
  constructor(private readonly db: DataSource) {}

  @Get('health') async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok', service: 'dgkart-api', time: new Date().toISOString() };
  }
}
