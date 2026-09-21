import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync, unlink } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CreateJobDto } from './create-job.dto';
import { PublicJob, VideoJob } from './job.types';
import { buildUncannyFilter, parseProbe, UncannyOptions, VideoInfo } from './uncanny-filter';
import { fitTimings } from './video-limits';

@Injectable()
export class JobsService {
  private readonly jobs = new Map<string, VideoJob>();
  private readonly storageDir = process.env.STORAGE_DIR ?? join(process.cwd(), 'storage');
  private readonly musicPath = process.env.MUSIC_PATH ?? join(process.cwd(), 'assets', 'music.m4a');

  constructor() {
    setInterval(() => this.cleanup(), 60 * 60 * 1000).unref();
  }

  /** Probes the video on upload: an out-of-range duration or timing is rejected before any rendering. */
  async create(file: Express.Multer.File, dto: CreateJobDto): Promise<PublicJob> {
    const info = await this.probe(file.path);
    const timings = fitTimings(info.duration, dto);
    if (dto.music !== 'none' && !existsSync(this.musicPath)) throw new ServiceUnavailableException({ code: 'music_unavailable', message: 'Music is not available on the server' });
    const id = randomUUID();
    const job: VideoJob = {
      id,
      originalName: file.originalname,
      inputPath: file.path,
      outputPath: join(this.storageDir, `${id}-uncanny.mp4`),
      status: 'queued', progress: 0, createdAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    void this.process(job, { ...timings, intensity: dto.intensity / 100, music: dto.music }, info);
    return this.toPublic(job);
  }

  getPublic(id: string) { return this.toPublic(this.get(id)); }

  getCompleted(id: string) {
    const job = this.get(id);
    if (job.status !== 'completed' || !existsSync(job.outputPath)) throw new NotFoundException('Render not available');
    return job;
  }

  remove(id: string) {
    const job = this.get(id);
    for (const path of [job.inputPath, job.outputPath]) unlink(path, () => undefined);
    this.jobs.delete(id);
    return { deleted: true };
  }

  private get(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private toPublic(job: VideoJob): PublicJob {
    return {
      id: job.id, originalName: job.originalName, status: job.status,
      progress: job.progress, createdAt: job.createdAt, error: job.error,
      ...(job.status === 'completed' ? { downloadUrl: `/api/jobs/${job.id}/download` } : {}),
    };
  }

  private async process(job: VideoJob, options: UncannyOptions, info: VideoInfo) {
    job.status = 'processing';
    try {
      const graph = buildUncannyFilter(options, info);
      const music = options.music !== 'none' ? ['-stream_loop', '-1', '-i', this.musicPath] : [];
      const audio = graph.audio.length ? [...graph.audio.flatMap(label => ['-map', label]), '-c:a', 'aac', '-b:a', '192k'] : [];
      const args = ['-y', '-i', job.inputPath, ...music, '-filter_complex', graph.filter, '-map', '[v]', ...audio, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', '-progress', 'pipe:2', '-nostats', job.outputPath];
      await this.runFfmpeg(args, (seconds) => job.progress = Math.min(99, Math.round(seconds / info.duration * 100)));
      job.status = 'completed'; job.progress = 100;
      unlink(job.inputPath, () => undefined);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'FFmpeg error';
    }
  }

  private probe(path: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const entries = 'format=duration:stream=codec_type,width,height,avg_frame_rate,r_frame_rate:stream_side_data=rotation:stream_tags=rotate';
      const child = spawn('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'json', path]);
      let output = ''; child.stdout.on('data', chunk => output += chunk);
      child.on('error', reject);
      child.on('close', code => {
        const unreadable = () => reject(new BadRequestException({ code: 'video_unreadable', message: 'Unreadable video' }));
        try {
          const info = code === 0 ? parseProbe(output) : undefined;
          return info ? resolve(info) : unreadable();
        } catch { unreadable(); }
      });
    });
  }

  private runFfmpeg(args: string[], onProgress: (seconds: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('ffmpeg', args);
      let stderr = '';
      child.stderr.on('data', chunk => {
        const text = chunk.toString(); stderr = (stderr + text).slice(-4000);
        const match = text.match(/out_time_ms=(\d+)/);
        if (match) onProgress(Number(match[1]) / 1_000_000);
      });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-600)}`)));
    });
  }

  private cleanup() {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [id, job] of this.jobs) if (Date.parse(job.createdAt) < cutoff && job.status !== 'processing') this.remove(id);
  }
}
