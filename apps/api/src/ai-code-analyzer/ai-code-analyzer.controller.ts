import {
  BadRequestException,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { AiCodeAnalyzerService } from './ai-code-analyzer.service';
import { GithubService } from '../github/github.service';

@Controller('ai-code-analyzer')
export class AiCodeAnalyzerController {
  private readonly logger = new Logger(AiCodeAnalyzerController.name);

  constructor(
    private readonly analyzerService: AiCodeAnalyzerService,
    private readonly githubService: GithubService,
  ) {}

  @Post('diagrams')
  async generateDiagram(
    @Query('analysisType') analysisType: string,
    @Query('repoUrl') repoUrl: string,
    @Query('githubToken') githubToken: string,
    @Query('codePath') codePath: string,
  ) {
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
      let files;
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
    }
  }

  @Post('questions')
  async answerCodeQuestion(
    @Query('question') question: string,
    @Query('repoUrl') repoUrl?: string,
    @Query('githubToken') githubToken?: string,
    @Query('codePath') codePath?: string,
  ) {
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

      let files;
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

      let answer: string;
      try {
        answer = await this.analyzerService.answerQuestionFromFiles(
          question,
          files,
        );
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

      return { answer };
    } catch (error) {
      this.logger.error(
        `Error answering question: ${error.message}`,
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
            message:
              error.message || 'An error occurred while analyzing the code',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
}
