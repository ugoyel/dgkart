import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDiskStorage, S3Storage, StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => (process.env.STORAGE_DRIVER === 's3' ? new S3Storage(c) : new LocalDiskStorage(c)),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
