import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(private readonly githubService: GithubService) {}

  @Post('connect')
  async connectGithub(@Body() body: { code: string }) {
    try {
      if (!body.code) {
        throw new BadRequestException('GitHub authorization code is required');
      }

      return await this.githubService.exchangeCodeForToken(body.code);
    } catch (error) {
      this.logger.error(
        `Error connecting to GitHub: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('repos')
  async getUserRepositories(@Headers('authorization') authHeader: string) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Invalid or missing GitHub token');
      }

      const token = authHeader.split(' ')[1];
      return await this.githubService.getUserRepositories(token);
    } catch (error) {
      this.logger.error(
        `Error fetching user repositories: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
