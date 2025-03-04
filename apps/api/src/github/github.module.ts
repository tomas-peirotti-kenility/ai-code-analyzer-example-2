import { Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
