import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { GenericError } from './errors';

@Catch()
export default class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionHandler');

  catch(exception: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (exception instanceof GenericError) {
      const asHttpException = GenericError.toHttpException(exception);
      const status = asHttpException.getStatus();
      response.status(status).json({ error: asHttpException.message });
    } else if (this.isMongooseValidationError(exception)) {
      const validationErrors = Object.values(exception.errors).map(
        (error: any) => ({
          field: error.path,
          message: error.message,
        }),
      );

      this.logger.error(exception, JSON.stringify(validationErrors));

      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Validation failed',
      });
    } else if (exception instanceof HttpException) {
      this.logger.error(exception, 'Received unhandled HttpException.');
      // TODO: improve error message
      response.status(exception.getStatus()).json({ error: exception.message });
    } else {
      this.logger.error(exception, 'Caught unexpected error.');
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Internal Server Error' });
    }
  }

  private isMongooseValidationError(exception: any): boolean {
    return (
      exception &&
      typeof exception === 'object' &&
      exception.name === 'ValidationError' &&
      typeof exception.errors === 'object'
    );
  }
}
