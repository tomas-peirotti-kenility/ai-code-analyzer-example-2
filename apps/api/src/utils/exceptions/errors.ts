/* eslint no-throw-literal: 0 */

import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class GenericError extends Error {
  message: string;
  type: ErrorType;
}

enum ErrorType {
  NOT_FOUND,
  ILLEGAL_ARGUMENT,
  FORBIDDEN,
  UNAUTHORIZED,
  EXTERNAL_ERROR,
  UNKNOWN,
  DATABASE,
}

export class NotFoundError extends GenericError {
  constructor(
    message: string = 'The entity you were looking for does not exist',
  ) {
    super();
    this.message = message;
    this.type = ErrorType.NOT_FOUND;
  }
}

export class IllegalArgumentError extends GenericError {
  constructor(message: string = 'The provided data is incorrect') {
    super();
    this.message = message;
    this.type = ErrorType.ILLEGAL_ARGUMENT;
  }
}

export class ForbiddenError extends GenericError {
  constructor(message: string = 'This operation is forbidden') {
    super();
    this.message = message;
    this.type = ErrorType.FORBIDDEN;
  }
}

export class UnauthorizedError extends GenericError {
  constructor(message: string = 'The authentication failed') {
    super();
    this.message = message;
    this.type = ErrorType.UNAUTHORIZED;
  }
}

export class ExternalServiceError extends GenericError {
  constructor(
    message: string = 'An error occurred while using an external service',
  ) {
    super();
    this.message = message;
    this.type = ErrorType.EXTERNAL_ERROR;
  }
}

export class UnknownError extends GenericError {
  constructor(message: string = 'Something unknown happened') {
    super();
    this.message = message;
    this.type = ErrorType.UNKNOWN;
  }
}

export class DatabaseError extends GenericError {
  constructor(
    message: string = 'There was an error processing the transaction in the database',
  ) {
    super();
    this.message = message;
    this.type = ErrorType.DATABASE;
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace GenericError {
  export function toHttpException(error: GenericError): HttpException {
    switch (error.type) {
      case ErrorType.NOT_FOUND:
        return new HttpException(error.message, HttpStatus.NOT_FOUND);
      case ErrorType.ILLEGAL_ARGUMENT:
        return new HttpException(error.message, HttpStatus.BAD_REQUEST);
      case ErrorType.UNAUTHORIZED:
        return new HttpException(error.message, HttpStatus.UNAUTHORIZED);
      case ErrorType.FORBIDDEN:
        return new HttpException(error.message, HttpStatus.FORBIDDEN);
      case ErrorType.EXTERNAL_ERROR:
        return new HttpException(error.message, HttpStatus.BAD_GATEWAY);
      case ErrorType.DATABASE:
        return new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      case ErrorType.UNKNOWN:
        return new HttpException(
          (error as UnknownError).message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }
}
