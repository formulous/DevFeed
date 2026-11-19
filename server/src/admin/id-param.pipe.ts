import { Injectable, PipeTransform } from '@nestjs/common';
import { Errors } from '../common/errors/app.exception';

@Injectable()
export class IdParamPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1) {
      throw Errors.validation([{ field: 'id', message: '1 이상 정수여야 함' }]);
    }
    return id;
  }
}
