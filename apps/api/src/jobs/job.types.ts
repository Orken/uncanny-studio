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
}

export interface PublicJob {
  id: string;
  originalName: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  error?: string;
  downloadUrl?: string;
}
