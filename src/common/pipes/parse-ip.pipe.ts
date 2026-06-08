import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isIP } from 'class-validator';

@Injectable()
export class ParseIpPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isIP(value)) {
      throw new BadRequestException(
        `'${value}' is not a valid IPv4 or IPv6 address`,
      );
    }
    return value;
  }
}
