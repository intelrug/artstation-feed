import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HTTPError } from 'got';

export function sleep(millis: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

export function httpErrorsTransformer(error: unknown): void {
  if (error instanceof HTTPError) {
    if (error.response.statusCode === 404) {
      throw new NotFoundException();
    } else if (error.response.statusCode === 403) {
      throw new ForbiddenException();
    }
  }
  throw error;
}
