import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { S3StorageService } from "./storage.service";
import { FileUrlSignerService } from "./file-url-signer.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [S3StorageService, FileUrlSignerService],
  exports: [S3StorageService, FileUrlSignerService],
})
export class StorageModule {}
