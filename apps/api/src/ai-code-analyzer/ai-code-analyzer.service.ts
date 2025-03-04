import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import type { Multer } from 'multer';
import {
  OPEN_AI_RELATION_ANALYZER_PROMPT,
  OPEN_AI_SEQUENCE_DIAGRAM_IMPROVER_PROMPT,
} from './ai-code-analyzer.constants';
import { generateSequenceDiagram } from './diagrams-generator/sequence-diagram-generator';
import { generateClassDiagram } from './diagrams-generator/class-diagram-generator';
import { Project, SyntaxKind } from 'ts-morph';

// Token estimation constants
const TOKENS_PER_CHAR = 0.25; // Rough estimate - 4 chars per token
const MAX_TOKENS_INPUT = 90000; // Safety margin below actual 100k token limit

@Injectable()
export class AiCodeAnalyzerService {
  private readonly logger = new Logger(AiCodeAnalyzerService.name);
  private readonly openai: OpenAI;

  constructor(private configService: ConfigService) {
    // Initialize OpenAI client
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Generate a Mermaid diagram based on uploaded code files
   */
  async generateDiagram(
    files: Multer.File[],
    analysisType: string,
  ): Promise<string> {
    try {
      // Read file contents
      const fileContents = await this.readFilesContent(files);

      // Check total token count
      const estimatedTokens = this.estimateTokenCount(fileContents);
      if (estimatedTokens > MAX_TOKENS_INPUT) {
        throw new BadRequestException({
          error: 'Token limit exceeded',
          message: `The code is too large for analysis (estimated ${Math.round(estimatedTokens / 1000)}k tokens). Please reduce the number of files or select a smaller codebase.`,
          estimatedTokens,
          maxTokens: MAX_TOKENS_INPUT,
        });
      }

      // Generate the appropriate prompt based on analysis type
      const prompt = this.generateDiagramPrompt(fileContents, analysisType);

      // Call OpenAI API
      const response = await this.generateWithOpenAI(prompt);

      // Extract and validate the Mermaid diagram code
      return this.extractMermaidCode(response);
    } catch (error) {
      this.logger.error(
        `Error in diagram generation: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate diagram');
    }
  }

  /**
   * Answer a question about code from uploaded files
   */
  async answerQuestionFromFiles(
    question: string,
    files: Multer.File[],
  ): Promise<string> {
    this.logger.log(`Received question: ${question}`);
    try {
      // Extract code context using ts-morph
      const codeContext = await this.extractCodeContext(files);

      this.logger.log(`Code context extracted.`);

      // Check total token count
      const estimatedTokens = this.estimateTokenCountByText(codeContext);
      this.logger.log(`Estimated tokens: ${estimatedTokens}`);

      if (estimatedTokens > MAX_TOKENS_INPUT) {
        throw new BadRequestException({
          error: 'Token limit exceeded',
          message: `The code is too large for analysis (estimated ${Math.round(estimatedTokens / 1000)}k tokens). Please reduce the number of files or select a smaller codebase.`,
          estimatedTokens,
          maxTokens: MAX_TOKENS_INPUT,
        });
      }

      // Generate prompt for the question
      const prompt = this.generateQuestionPrompt(question, codeContext);

      // Call OpenAI API
      return await this.generateWithOpenAI(prompt);
    } catch (error) {
      this.logger.error(
        `Error answering question from files: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to answer question about code',
      );
    }
  }

  /**
   * Estimate token count from file contents
   */
  private estimateTokenCount(
    files: Array<{ name: string; content: string }>,
  ): number {
    // Simple token estimation based on character count
    let totalChars = 0;

    // Add characters from files
    for (const file of files) {
      totalChars += file.name.length;
      totalChars += file.content.length;
    }

    // Add overhead for prompt structure
    totalChars += 500; // Prompt instructions

    return Math.ceil(totalChars * TOKENS_PER_CHAR);
  }

  private estimateTokenCountByText(content: string): number {
    // Simple token estimation based on character count
    let totalChars = content.length;

    // Add overhead for prompt structure
    totalChars += 500; // Prompt instructions

    return Math.ceil(totalChars * TOKENS_PER_CHAR);
  }

  /**
   * Read the contents of all uploaded files
   */
  private async readFilesContent(
    files: Multer.File[],
  ): Promise<Array<{ name: string; content: string }>> {
    return Promise.all(
      files.map(async (file) => {
        try {
          const content = await fs.promises.readFile(file.path, 'utf8');
          return {
            name: file.originalname,
            content,
          };
        } catch (error) {
          this.logger.error(
            `Error reading file ${file.path}/${file.originalname}: ${error.message}`,
          );
          throw new BadRequestException(
            `Failed to read file: ${file.path}/${file.originalname}`,
          );
        }
      }),
    );
  }

  /**
   * Generate an appropriate prompt for OpenAI based on file contents and analysis type
   */
  private generateDiagramPrompt(
    files: Array<{ name: string; content: string }>,
    analysisType: string,
  ): string {
    // Basic file information for the prompt
    const fileInfo = files
      .map((file) => `File: ${file.name}\n\n${file.content}`)
      .join('\n\n-----------------------------------------\n\n');

    // Base prompt instruction
    let prompt = `Analyze the following code files and generate a ${analysisType} using Mermaid syntax.\n\n`;

    // Add specific instructions based on diagram type
    switch (analysisType.toLowerCase()) {
      case 'sequence':
        prompt +=
          'Create a sequence diagram showing the interactions between components, functions, or classes. Focus on the flow of method calls and data between entities.\n\n';
        break;

      case 'classdiagram':
        prompt +=
          'Create a class diagram showing the classes, their properties, methods, and relationships. Include inheritance, associations, and compositions where relevant.\n\n';
        break;

      case 'dependencies':
        prompt +=
          'Create a dependency graph showing how files or modules depend on each other. Focus on import statements and module relationships.\n\n';
        break;

      case 'flowchart':
        prompt +=
          'Create a flowchart showing the control flow of the main functions. Focus on decision points, loops, and the logical flow of execution.\n\n';
        break;

      default:
        prompt +=
          'Create a diagram that best represents the structure and relationships in the code.\n\n';
    }

    // Add specific formatting instructions
    prompt +=
      'Only return a valid Mermaid diagram with no additional text. Use the appropriate Mermaid syntax for the requested diagram type.\n\n';
    prompt += 'Here are the code files to analyze:\n\n';
    prompt += fileInfo;

    return prompt;
  }

  /**
   * Generate a prompt for answering questions about code
   */
  private generateQuestionPrompt(question: string, context: string): string {
    // Basic file information for the prompt
    const fileInfo = context;

    // Construct the prompt
    const prompt = `I have some code files from a repository that I'd like you to analyze and answer a question about. The context includes functions, classes, interfaces, and their relationships.
    
    Question: ${question}

    Please provide a detailed and helpful answer based on the code. If the question is unclear or cannot be answered based on the provided code, explain why and what additional information would be needed.

    Here are the code files:

    ${fileInfo}`;

    return prompt;
  }

  /**
   * Call OpenAI API to generate content
   */
  private async generateWithOpenAI(prompt: string): Promise<string> {
    try {
      const model =
        this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo';
      const temperature = parseFloat(
        this.configService.get<string>('TEMPERATURE') || '0.2',
      );
      const maxTokens = parseInt(
        this.configService.get<string>('MAX_TOKENS') || '4000',
        10,
      );

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a code analysis assistant that helps analyze code and generates diagrams or explanations based on the code provided.',
          },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      if (
        !response.choices ||
        response.choices.length === 0 ||
        !response.choices[0].message
      ) {
        throw new Error('Invalid response from OpenAI API');
      }

      return response.choices[0].message.content || '';
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`, error.stack);
      throw new Error(`OpenAI API request failed: ${error.message}`);
    }
  }

  /**
   * Extract Mermaid code from OpenAI response and validate it
   */
  private extractMermaidCode(response: string): string {
    // Check if the response is already clean Mermaid code
    if (this.isMermaidCode(response)) {
      return response.trim();
    }

    // Try to extract from markdown code blocks
    const mermaidRegex = /```(?:mermaid)?\s*([\s\S]*?)```/;
    const match = response.match(mermaidRegex);

    if (match && match[1]) {
      const extractedCode = match[1].trim();
      if (this.isMermaidCode(extractedCode)) {
        return extractedCode;
      }
    }

    // If we can't extract valid Mermaid code, return the response as is
    // The client will handle rendering errors
    this.logger.warn('Could not extract clean Mermaid code from response');
    return response.trim();
  }

  /**
   * Check if a string is valid Mermaid code
   */
  private isMermaidCode(code: string): boolean {
    // Simple validation for common Mermaid diagram types
    const diagrams = [
      'graph',
      'flowchart',
      'sequenceDiagram',
      'classDiagram',
      'stateDiagram',
      'erDiagram',
      'journey',
      'gantt',
      'pie',
    ];

    const firstLine = code.trim().split('\n')[0].trim();
    return diagrams.some(
      (diagramType) =>
        firstLine.startsWith(diagramType) ||
        firstLine.startsWith(`${diagramType} `),
    );
  }

  async generateTsMermaidDiagram(
    files: Array<{ originalname: string; path: string; content: string }>,
  ): Promise<string> {
    try {
      // Check total token count
      const estimatedTokens = this.estimateTokenCountFromFiles(files);
      if (estimatedTokens > MAX_TOKENS_INPUT) {
        throw new BadRequestException({
          error: 'Token limit exceeded',
          message: `The code is too large for analysis (estimated ${Math.round(estimatedTokens / 1000)}k tokens). Please reduce the number of files or select a smaller codebase.`,
          estimatedTokens,
          maxTokens: MAX_TOKENS_INPUT,
        });
      }

      return this.improveClassDiagramWithOpenAI(
        await generateClassDiagram(files),
      );
      // return await generateClassDiagram(files);
    } catch (error) {
      this.logger.error(
        `Error generating ts-mermaid diagram: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to generate ts-mermaid diagram',
      );
    }
  }

  async generateTsSequenceDiagram(
    files: Array<{ originalname: string; path: string; content: string }>,
  ): Promise<string> {
    try {
      // Check total token count
      const estimatedTokens = this.estimateTokenCountFromFiles(files);
      if (estimatedTokens > MAX_TOKENS_INPUT) {
        throw new BadRequestException({
          error: 'Token limit exceeded',
          message: `The code is too large for analysis (estimated ${Math.round(estimatedTokens / 1000)}k tokens). Please reduce the number of files or select a smaller codebase.`,
          estimatedTokens,
          maxTokens: MAX_TOKENS_INPUT,
        });
      }

      return this.improveSequenceDiagramWithOpenAI(
        await generateSequenceDiagram(files),
      );
    } catch (error) {
      this.logger.error(
        `Error generating ts-mermaid diagram: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to generate ts-mermaid diagram',
      );
    }
  }

  /**
   * Estimate token count from files with content
   */
  private estimateTokenCountFromFiles(
    files: Array<{ originalname: string; content: string }>,
  ): number {
    // Simple token estimation based on character count
    let totalChars = 0;

    // Add characters from files
    for (const file of files) {
      totalChars += file.originalname.length;
      totalChars += file.content.length;
    }

    // Add overhead for prompt structure
    totalChars += 500; // Prompt instructions

    return Math.ceil(totalChars * TOKENS_PER_CHAR);
  }

  /**
   * Call OpenAI API to improve sequence diagram
   */
  async improveSequenceDiagramWithOpenAI(mermaidCode: string): Promise<string> {
    try {
      const model =
        this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo';
      const temperature = parseFloat(
        this.configService.get<string>('TEMPERATURE') || '0.2',
      );
      const maxTokens = parseInt(
        this.configService.get<string>('MAX_TOKENS') || '4000',
        10,
      );

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a code analysis assistant that helps analyze code and generates diagrams or explanations based on the code provided.',
          },
          {
            role: 'user',
            content: `${OPEN_AI_SEQUENCE_DIAGRAM_IMPROVER_PROMPT}
            Mermaid code:
            \`\`\`mermaid
            ${mermaidCode}
            \`\`\``, // Add the Mermaid code to the prompt
          },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      if (
        !response.choices ||
        response.choices.length === 0 ||
        !response.choices[0].message
      ) {
        throw new Error('Invalid response from OpenAI API');
      }

      const content = response.choices[0].message.content || '';
      const startIndex = content.indexOf('sequenceDiagram');
      const endIndex = content.lastIndexOf('```');
      return startIndex !== -1 && endIndex !== -1
        ? content.substring(startIndex, endIndex).trim()
        : content;
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`, error.stack);
      throw new Error(`OpenAI API request failed: ${error.message}`);
    }
  }

  async improveClassDiagramWithOpenAI(mermaidCode: string): Promise<string> {
    try {
      const model =
        this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo';
      const temperature = parseFloat(
        this.configService.get<string>('TEMPERATURE') || '0.2',
      );
      const maxTokens = parseInt(
        this.configService.get<string>('MAX_TOKENS') || '4000',
        10,
      );

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a code analysis assistant that helps analyze code and generates diagrams or explanations based on the code provided.',
          },
          {
            role: 'user',
            content: `${OPEN_AI_RELATION_ANALYZER_PROMPT}
            Mermaid code:
            \`\`\`mermaid
            ${mermaidCode}
            \`\`\``, // Add the Mermaid code to the prompt
          },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      if (
        !response.choices ||
        response.choices.length === 0 ||
        !response.choices[0].message
      ) {
        throw new Error('Invalid response from OpenAI API');
      }

      const content = response.choices[0].message.content || '';
      const index = content.indexOf('classDiagram');
      return index !== -1 ? content.substring(index).trim() : content;
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`, error.stack);
      throw new Error(`OpenAI API request failed: ${error.message}`);
    }
  }

  private async extractCodeContext(files: Multer.File[]): Promise<string> {
    const project = new Project();

    // Add files to the project
    files.forEach((file) => {
      project.addSourceFileAtPath(file.path);
    });

    const sourceFiles = project.getSourceFiles();
    const context = sourceFiles.map((sourceFile) => {
      const filePath = sourceFile.getFilePath();

      const classes = sourceFile.getClasses().map((c) => {
        const extendsClause = c.getExtends();
        const baseClass = extendsClause ? extendsClause.getText() : null;

        const implementsClauses = c.getImplements();
        const implementedInterfaces = implementsClauses.map((i) => i.getText());

        return {
          name: c.getName(),
          methods: c.getMethods().map((m) => m.getName()),
          properties: c.getProperties().map((p) => p.getName()),
          baseClass: baseClass,
          implementedInterfaces: implementedInterfaces,
        };
      });

      const interfaces = sourceFile.getInterfaces().map((i) => ({
        name: i.getName(),
        methods: i.getMethods().map((m) => m.getName()),
        properties: i.getProperties().map((p) => p.getName()),
      }));

      const functions = sourceFile.getFunctions().map((f) => {
        const functionName = f.getName();
        const calls = f
          .getDescendants()
          .filter((d) => d.getKindName() === 'CallExpression')
          .map((call) => {
            const identifier = call.getFirstChildIfKind(SyntaxKind.Identifier);
            return identifier ? identifier.getText() : null;
          })
          .filter((name) => name !== null); // Filter out nulls

        return {
          name: functionName,
          calls: calls,
        };
      });

      return {
        filePath,
        classes,
        interfaces,
        functions,
      };
    });

    return JSON.stringify(context, null, 2);
  }

  async cleanupFiles(
    files: {
      originalname: string;
      path: string;
      content: string;
      filename: string;
    }[],
  ): Promise<void> {
    try {
      this.logger.log(`Deleting ${files?.length} files...`);
      for (const file of files) {
        if (fs.existsSync(file.filename)) {
          fs.unlinkSync(file.filename);
        } else {
          this.logger.warn(`File not found, cannot delete: ${file.filename}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error cleaning up files: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
