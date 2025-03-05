import { HttpException, HttpStatus } from '@nestjs/common';
import { getReasonPhrase } from 'http-status-codes';

export class HttpFormattedException extends HttpException {
  constructor(httpStatus: HttpStatus) {
    super(getReasonPhrase(httpStatus), httpStatus);
  }
}
