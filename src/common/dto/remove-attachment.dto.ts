import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveAttachmentDto {
  @ApiProperty({
    description: 'URL of the attachment to remove',
    example: 'https://s3.example.com/wfh-documents/abc123.jpg',
  })
  @IsString()
  url!: string;
}
