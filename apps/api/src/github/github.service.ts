import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly MAX_TOTAL_SIZE = 500 * 1024; // 500KB total size limit for all files
  private readonly MAX_FILES = 20; // Maximum number of files to process

  constructor(private configService: ConfigService) {}

  /**
   * Exchange GitHub authorization code for access token
   */
  async exchangeCodeForToken(code: string) {
    try {
      const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GITHUB_CLIENT_SECRET',
      );

      if (!clientId || !clientSecret) {
        throw new BadRequestException('GitHub OAuth configuration is missing');
      }

      // Exchange code for token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!tokenResponse.data.access_token) {
        throw new BadRequestException('Failed to obtain GitHub access token');
      }

      // Get user information
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${tokenResponse.data.access_token}`,
        },
      });

      return {
        user: {
          id: userResponse.data.id,
          login: userResponse.data.login,
          name: userResponse.data.name,
          avatar_url: userResponse.data.avatar_url,
          token: tokenResponse.data.access_token,
        },
      };
    } catch (error) {
      this.logger.error(`GitHub OAuth error: ${error.message}`, error.stack);
      throw new BadRequestException('GitHub authentication failed');
    }
  }

  /**
   * Get user's repositories from GitHub
   */
  async getUserRepositories(token: string) {
    try {
      // Get user repositories
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          sort: 'updated',
          per_page: 100,
        },
      });

      return response.data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        language: repo.language,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching GitHub repositories: ${error.message}`,
        error.stack,
      );

      if (error.response?.status === 401) {
        throw new UnauthorizedException('Invalid or expired GitHub token');
      }

      throw new BadRequestException('Failed to fetch GitHub repositories');
    }
  }

  /**
   * Get files from a GitHub repository
   */
  async getFilesFromRepo(
    repoUrl: string,
    token: string,
    codePath: string = './src',
  ): Promise<any[]> {
    try {
      // Parse repository information
      const { owner, repo } = this.parseRepoUrl(repoUrl);

      // Get the default branch
      const repoInfo = await this.getRepoInfo(owner, repo, token);
      const defaultBranch = repoInfo.default_branch;

      // Fetch files from repository
      const files = await this.fetchFilesRecursively(
        owner,
        repo,
        codePath,
        defaultBranch,
        token,
      );

      // Download and prepare files
      const downloadedFiles = await this.downloadFiles(
        files,
        owner,
        repo,
        defaultBranch,
        token,
      );

      // Check if total size exceeds the limit
      const totalSize = this.calculateTotalSize(downloadedFiles);

      if (totalSize > this.MAX_TOTAL_SIZE) {
        throw new BadRequestException({
          error: 'Repository size too large',
          message: `The total size of files (${Math.round(totalSize / 1024)}KB) exceeds the maximum allowed size (${Math.round(this.MAX_TOTAL_SIZE / 1024)}KB). Please select a smaller repository or use a more specific path.`,
          totalSize,
          maxSize: this.MAX_TOTAL_SIZE,
        });
      }

      if (downloadedFiles.length > this.MAX_FILES) {
        throw new BadRequestException({
          error: 'Too many files',
          message: `The repository contains ${downloadedFiles.length} files, which exceeds the maximum limit of ${this.MAX_FILES} files. Please select a more specific path.`,
          fileCount: downloadedFiles.length,
          maxFiles: this.MAX_FILES,
        });
      }

      return downloadedFiles;
    } catch (error) {
      this.logger.error(
        `Error fetching files from GitHub: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.response?.data?.message ||
          'Failed to fetch files from GitHub repository',
      );
    }
  }

  /**
   * Parse GitHub repository URL to extract owner and repo name
   */
  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts.length < 2) {
        throw new BadRequestException('Invalid GitHub repository URL');
      }

      return {
        owner: pathParts[0],
        repo: pathParts[1],
      };
    } catch (error) {
      throw new BadRequestException('Invalid GitHub repository URL');
    }
  }

  /**
   * Get repository information
   */
  private async getRepoInfo(owner: string, repo: string, token: string) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo.replace('.git', '')}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error getting repo info: ${error.message}`);
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to get repository information',
      );
    }
  }

  /**
   * Fetch files recursively from GitHub repository
   */
  private async fetchFilesRecursively(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    token: string,
    maxDepth = 3, // Limit recursion depth
    currentDepth = 0,
  ): Promise<any[]> {
    if (currentDepth > maxDepth) {
      this.logger.warn(`Maximum recursion depth reached for path: ${path}`);
      return [];
    }

    try {
      // Normalize path
      const normalizedPath = path.startsWith('./') ? path.substring(2) : path;
      const url = `https://api.github.com/repos/${owner}/${repo.replace('.git', '')}/contents/${normalizedPath}`;
      this.logger.log('Downloading content', url);
      const response = await axios.get(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          ref: branch,
        },
      });

      const contents = response.data;
      let files = [];

      if (Array.isArray(contents)) {
        for (const item of contents) {
          if (item.type === 'file' && this.isValidFileType(item.name)) {
            files.push(item);
          } else if (item.type === 'dir') {
            const subFiles = await this.fetchFilesRecursively(
              owner,
              repo,
              item.path,
              branch,
              token,
              maxDepth,
              currentDepth + 1,
            );
            files = [...files, ...subFiles];
          }
        }
      } else if (
        contents.type === 'file' &&
        this.isValidFileType(contents.name)
      ) {
        files.push(contents);
      }

      return files;
    } catch (error) {
      this.logger.warn(
        `Error fetching files from path ${path}: ${error.message}`,
      );
      throw new BadRequestException(
        `Error fetching files from path ${path}: ${error.message}`,
      );
    }
  }

  /**
   * Check if file type is valid for analysis
   */
  private isValidFileType(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const validExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.java',
      '.py',
      '.html',
      '.css',
      '.json',
      '.md',
      '.php',
      '.go',
      '.rb',
      '.rs',
      '.c',
      '.cpp',
      '.h',
      '.hpp',
      '.cs',
      '.swift',
      '.kt',
      '.kts',
      '.scala',
      '.sh',
      '.bash',
    ];

    return validExtensions.includes(ext);
  }

  /**
   * Download files from GitHub and prepare them for analysis
   */
  private async downloadFiles(
    files: any[],
    owner: string,
    repo: string,
    branch: string,
    token: string,
  ): Promise<
    Array<{ originalname: string; path: string; content: string; size: number }>
  > {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const downloadedFiles = [];

    for (const file of files) {
      try {
        const response = await axios.get(file.download_url, {
          headers: {
            Authorization: `token ${token}`,
          },
        });

        const content = response.data;
        const filePath = path.join(uploadPath, `${Date.now()}-${file.name}`);

        fs.writeFileSync(filePath, content);

        downloadedFiles.push({
          originalname: file.path,
          path: filePath,
          content,
          size: Buffer.byteLength(content, 'utf8'),
        });
      } catch (error) {
        this.logger.error(
          `Error downloading file ${file.path}: ${error.message}`,
        );
        // Continue with other files
      }
    }

    return downloadedFiles;
  }

  /**
   * Calculate total size of files
   */
  private calculateTotalSize(files: Array<{ size: number }>): number {
    return files.reduce((total, file) => total + file.size, 0);
  }
}
