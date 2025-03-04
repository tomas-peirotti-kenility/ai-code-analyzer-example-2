import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import AppService from '../src/app.service';
import AppController from '../src/app.controller';
import { PlaygroundModule } from './playground/playground.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AiCodeAnalyzerModule } from './ai-code-analyzer/ai-code-analyzer.module';
import { GithubModule } from './github/github.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api*'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            messageKey: 'message',
          },
        },
        messageKey: 'message',
        autoLogging: false,
        serializers: {
          req: () => undefined,
          res: () => undefined,
        },
      },
    }),
    TerminusModule,
    PlaygroundModule,
    AiCodeAnalyzerModule,
    GithubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
