import {
  BadRequestException,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { AiCodeAnalyzerService } from './ai-code-analyzer.service';
import { GithubService } from '../github/github.service';
import { CacheService } from '../cache/cache.service';

@Controller('ai-code-analyzer')
export class AiCodeAnalyzerController {
  private readonly logger = new Logger(AiCodeAnalyzerController.name);

  constructor(
    private readonly analyzerService: AiCodeAnalyzerService,
    private readonly githubService: GithubService,
    private cacheService: CacheService,
  ) {}

  @Post('diagrams')
  async generateDiagram(
    @Query('analysisType') analysisType: string,
    @Query('repoUrl') repoUrl: string,
    @Query('githubToken') githubToken: string,
    @Query('codePath') codePath: string,
  ) {
    let files;
    try {
      this.logger.log(
        `Received request for ${analysisType} diagram generation. Repo url: ${repoUrl}. Path: ${codePath}`,
      );
      if (!repoUrl) {
        throw new BadRequestException('Repository URL is required');
      }
      if (!githubToken) {
        throw new BadRequestException('Github token is required');
      }

      try {
        files = await this.githubService.getFilesFromRepo(
          repoUrl,
          githubToken,
          codePath,
        );
      } catch (error) {
        // Enhanced error handling for repository issues
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(`GitHub API error: ${error.message}`, error.stack);
        throw new BadRequestException({
          error: 'GitHub Repository Error',
          message:
            error.message || 'Failed to retrieve files from GitHub repository',
        });
      }

      let mermaidCode: string;

      // Process files and generate diagram
      try {
        if (analysisType === 'sequence') {
          mermaidCode =
            await this.analyzerService.generateTsSequenceDiagram(files);
        } else {
          // Default to class diagram
          mermaidCode =
            await this.analyzerService.generateTsMermaidDiagram(files);
        }
      } catch (error) {
        // Enhanced error handling for token limit exceeded
        if (error instanceof BadRequestException) {
          throw error;
        } else if (error.message && error.message.includes('token')) {
          throw new BadRequestException({
            error: 'Token limit exceeded',
            message:
              'The code is too large for analysis. Please reduce the number of files or select a smaller codebase.',
          });
        }
        throw error;
      }

      return { mermaidCode };
    } catch (error) {
      this.logger.error(
        `Error generating diagram: ${error.message}`,
        error.stack,
      );

      // Format the error response to be more user-friendly
      if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException(
          {
            error: 'Analysis Error',
            message: error.message || 'An error occurred during code analysis',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } finally {
      if (files) {
        await this.analyzerService.cleanupFiles(files);
      }
    }
  }

  private async getRepoFiles(
    repoUrl: string,
    githubToken: string,
    codePath: string,
  ) {
    try {
      return await this.githubService.getFilesFromRepo(
        repoUrl,
        githubToken,
        codePath,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`GitHub API error: ${error.message}`, error.stack);
      throw new BadRequestException({
        error: 'GitHub Repository Error',
        message:
          error.message || 'Failed to retrieve files from GitHub repository',
      });
    }
  }

  private handleAnalysisError(error: any) {
    this.logger.error(
      `Error answering question: ${error.message}`,
      error.stack,
    );

    if (error instanceof BadRequestException) {
      throw error;
    } else if (error instanceof HttpException) {
      throw error;
    } else if (error.message && error.message.includes('token')) {
      throw new BadRequestException({
        error: 'Token limit exceeded',
        message:
          'The code is too large for analysis. Please reduce the number of files or select a smaller codebase.',
      });
    } else {
      throw new HttpException(
        {
          error: 'Analysis Error',
          message:
            error.message || 'An error occurred while analyzing the code',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('questions')
  async answerCodeQuestion(
    @Query('question') question: string,
    @Query('repoUrl') repoUrl?: string,
    @Query('githubToken') githubToken?: string,
    @Query('codePath') codePath?: string,
    @Body('uploadedFile') uploadedFile?: { name: string; content: string },
  ) {
    let files;
    try {
      if (!question) {
        throw new BadRequestException('Question is required');
      }

      if (!repoUrl) {
        throw new BadRequestException('Repository URL is required');
      }
      if (!githubToken) {
        throw new BadRequestException('Github token is required');
      }

      const cacheKey = this.cacheService.generateKey(
        repoUrl,
        codePath,
        'questions',
      );
      const codeContext: string | undefined =
        this.cacheService.get<string>(cacheKey);

      if (codeContext) {
        const answer = await this.analyzerService.answerQuestionFromFiles(
          question,
          null,
          repoUrl,
          codePath,
          codeContext,
          uploadedFile,
        );

        return {
          answer: this.analyzerService.replaceFilePathsWithNames(answer),
        };
      }

      files = await this.getRepoFiles(repoUrl, githubToken, codePath);

      let answer: string;
      try {
        answer = await this.analyzerService.answerQuestionFromFiles(
          question,
          files,
          repoUrl,
          codePath,
          undefined,
          uploadedFile,
        );
      } catch (error) {
        this.handleAnalysisError(error);
      }

      return { answer: this.analyzerService.replaceFilePathsWithNames(answer) };
    } catch (error) {
      this.handleAnalysisError(error);
    } finally {
      if (files) {
        await this.analyzerService.cleanupFiles(files);
      }
    }
  }
}
