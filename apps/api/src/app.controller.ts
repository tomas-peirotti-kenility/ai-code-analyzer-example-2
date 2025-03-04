import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller()
export default class AppController {
  constructor(private health: HealthCheckService) {}

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([]);
  }

  @Get('ui-config.js')
  serveConfig() {
    return `window.APP_CONFIG = {
      API_URL: '${process.env.API_URL}',
      VOICEBOT_API_URL: '${process.env.VOICEBOT_API_URL}',
      STATIC_SERVER_URL: '${process.env.STATIC_SERVER_URL}',
      WS_URL: '${process.env.WS_URL}',
      GITHUB_CLIENT_ID: '${process.env.GITHUB_CLIENT_ID}'
    };`;
  }
}
