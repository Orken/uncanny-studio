import { ArgumentsHost, BadRequestException, Body, Catch, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync, unlink } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CreateJobDto } from './create-job.dto';
import { JobsService } from './jobs.service';

const storageDir = process.env.STORAGE_DIR ?? join(process.cwd(), 'storage');
mkdirSync(storageDir, { recursive: true });

/** Deletes the uploaded video when the request fails (invalid DTO, out-of-range duration…): no job would ever clean it up. */
@Catch()
class DiscardUploadOnError extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const file = host.switchToHttp().getRequest<Request>().file;
    if (file) unlink(file.path, () => undefined);
    super.catch(exception, host);
  }
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('video', {
    storage: diskStorage({
      destination: storageDir,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB ?? 250) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'].includes(file.mimetype)),
  }))
  @UseFilters(DiscardUploadOnError)
  async create(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: CreateJobDto) {
    if (!file) throw new BadRequestException({ code: 'video_missing', message: 'Missing video or unsupported format' });
    return this.jobs.create(file, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.jobs.getPublic(id); }

  @Get(':id/download')
  download(@Param('id') id: string, @Res() response: Response) {
    const job = this.jobs.getCompleted(id);
    response.download(job.outputPath, `uncanny-${job.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}.mp4`);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.jobs.remove(id); }
}
