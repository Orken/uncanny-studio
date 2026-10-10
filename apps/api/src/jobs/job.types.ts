export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoJob {
  id: string;
  originalName: string;
  inputPath: string;
  outputPath: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  error?: string;
  /** Aborts the running FFmpeg process (job deleted while rendering). */
  abort?: AbortController;
}

export interface PublicJob {
  id: string;
  originalName: string;
  status: JobStatus;
  progress: number;
  /** 1-based rank while waiting for a render slot. */
  queuePosition?: number;
  createdAt: string;
  error?: string;
  downloadUrl?: string;
}
