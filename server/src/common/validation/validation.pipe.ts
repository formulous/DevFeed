import { ValidationError, ValidationPipe } from '@nestjs/common';
import { Errors, FieldError } from '../errors/app.exception';

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([key, message]) => ({
      field,
      message: key === 'whitelistValidation' ? '허용되지 않은 필드예요' : message,
    }));
    const nested = flattenValidationErrors(error.children ?? [], field);
    return [...own.slice(0, 1), ...nested];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => Errors.validation(flattenValidationErrors(errors)),
  });
}
