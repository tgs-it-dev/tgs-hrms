import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageService } from './storage.service';
import { FileUrlSignerService } from './file-url-signer.service';
import { DocumentUploadService } from './document-upload.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [S3StorageService, FileUrlSignerService, DocumentUploadService],
  exports: [S3StorageService, FileUrlSignerService, DocumentUploadService],
})
export class StorageModule {}
