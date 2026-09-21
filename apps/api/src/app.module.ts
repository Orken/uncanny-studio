import { Module } from '@nestjs/common';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';

@Module({ controllers: [JobsController], providers: [JobsService] })
export class AppModule {}
