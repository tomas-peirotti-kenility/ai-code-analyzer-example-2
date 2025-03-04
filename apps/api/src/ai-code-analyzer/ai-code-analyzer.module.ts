import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AiCodeAnalyzerController } from './ai-code-analyzer.controller';
import { AiCodeAnalyzerService } from './ai-code-analyzer.service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [
    // Import ConfigModule to access environment variables (like OPENAI_API_KEY)
    ConfigModule,

    // Configure MulterModule for file uploads
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB file size limit
      },
    }),
    GithubModule,
  ],
  controllers: [AiCodeAnalyzerController],
  providers: [AiCodeAnalyzerService],
  exports: [AiCodeAnalyzerService],
})
export class AiCodeAnalyzerModule {}
