import { Module } from '@nestjs/common';
import { SysDbService } from '../services/sys-db.service';

@Module({
  providers: [SysDbService],
  exports: [SysDbService],
})
export class SysDbModule {}
