import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18n, Lang, Message, MessageKey } from './i18n';

interface VideoJob { id: string; status: 'queued'|'processing'|'completed'|'failed'; progress: number; error?: string; downloadUrl?: string; }
/** Same values as MUSIC_MODES in apps/api/src/jobs/uncanny-filter.ts. */
type MusicMode = 'none' | 'over' | 'crossfade' | 'replace';

// Same limits as apps/api/src/jobs/video-limits.ts: the API checks them again on upload.
const MIN_VIDEO_SECONDS = 8;
const MAX_VIDEO_SECONDS = 76;
const MIN_TRANSITION_SECONDS = 1;

@Component({
  selector: 'app-root', standalone: true, imports: [FormsModule],
  templateUrl: './app.component.html', styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly i18n = inject(I18n);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly n = this.i18n.n.bind(this.i18n);
  readonly languages: Lang[] = ['fr', 'en'];
  file = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  job = signal<VideoJob | null>(null);
  uploadProgress = signal(0);
  error = signal<Message | null>(null);
  dragging = signal(false);
  videoDuration = signal(0);
  start = 0;
  duration = 0;
  intensity = 75;
  music: MusicMode = 'none';
  readonly musicModes: { value: MusicMode; label: MessageKey }[] = [
    { value: 'none', label: 'music.none' },
    { value: 'over', label: 'music.over' },
    { value: 'crossfade', label: 'music.crossfade' },
    { value: 'replace', label: 'music.replace' },
  ];
  readonly limits = { min: MIN_VIDEO_SECONDS, max: MAX_VIDEO_SECONDS };
  private poll?: ReturnType<typeof setInterval>;

  choose(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setFile(input.files[0]);
  }

  drop(event: DragEvent) {
    event.preventDefault(); this.dragging.set(false);
    if (event.dataTransfer?.files[0]) this.setFile(event.dataTransfer.files[0]);
  }

  setFile(file: File) {
    if (!file.type.startsWith('video/')) { this.error.set({ key: 'error.not_video' }); return; }
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.videoDuration.set(0); this.start = 0; this.duration = 0;
    this.file.set(file); this.previewUrl.set(URL.createObjectURL(file)); this.error.set(null); this.job.set(null);
  }

  readDuration(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video.currentSrc !== this.previewUrl() || this.videoDuration()) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      this.metadataError(event); return;
    }
    this.videoDuration.set(video.duration);
    this.start = video.duration / 4;
    this.duration = video.duration / 2;
    this.error.set(this.durationAccepted ? null : {
      key: 'error.video_duration',
      params: { min: MIN_VIDEO_SECONDS, max: MAX_VIDEO_SECONDS, duration: Number(video.duration.toFixed(1)) },
    });
  }

  metadataError(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video.currentSrc === this.previewUrl() && !this.videoDuration()) this.error.set({ key: 'error.metadata' });
  }

  get minimumTransition() { return MIN_TRANSITION_SECONDS; }
  get solarizedDuration() { return Math.max(0, this.videoDuration() - this.start - this.duration); }
  get durationAccepted() { return this.videoDuration() >= MIN_VIDEO_SECONDS && this.videoDuration() <= MAX_VIDEO_SECONDS; }
  /** Same formula as musicFadeSeconds in the API. */
  get musicFade() { return Math.min(3, Math.max(1, this.videoDuration() / 25)); }

  changeStart(value: number) {
    this.start = Math.max(0, Math.min(value, this.videoDuration() - this.minimumTransition));
    this.duration = Math.min(this.duration, this.videoDuration() - this.start);
  }

  render() {
    const file = this.file(); if (!file || !this.durationAccepted) return;
    this.error.set(null); this.uploadProgress.set(0);
    const body = new FormData(); body.append('video', file); body.append('start', String(this.start)); body.append('duration', String(this.duration)); body.append('intensity', String(this.intensity)); body.append('music', this.music);
    this.http.post<VideoJob>('/api/jobs', body, { observe: 'events', reportProgress: true }).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress) this.uploadProgress.set(Math.round(100 * event.loaded / (event.total ?? event.loaded)));
        if (event.type === HttpEventType.Response && event.body) { this.job.set(event.body); this.beginPolling(event.body.id); }
      },
      error: (err: HttpErrorResponse) => { this.uploadProgress.set(0); this.error.set(this.apiError(err)); },
    });
  }

  /** Keeps the video and settings so they can be tweaked for another render; the previous render is deleted. */
  newRender() {
    this.discardJob();
    this.uploadProgress.set(0); this.error.set(null);
  }

  reset() {
    this.discardJob();
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.file.set(null); this.previewUrl.set(null); this.uploadProgress.set(0); this.error.set(null);
    this.videoDuration.set(0); this.start = 0; this.duration = 0;
  }

  private discardJob() {
    if (this.poll) { clearInterval(this.poll); this.poll = undefined; }
    const current = this.job(); if (current) this.http.delete(`/api/jobs/${current.id}`).subscribe({ error: () => undefined });
    this.job.set(null);
  }

  /** Translates the API's error codes; other errors (e.g. ValidationPipe, which sends an array) are shown as is. */
  private apiError(err: HttpErrorResponse): Message {
    const { code, params, message } = err.error ?? {};
    const key = `error.${code}`;
    if (code && this.i18n.has(key)) return { key, params };
    if (Array.isArray(message)) return { text: message.join('\n') };
    return typeof message === 'string' ? { text: message } : { key: 'error.upload' };
  }

  private beginPolling(id: string) {
    this.poll = setInterval(() => this.http.get<VideoJob>(`/api/jobs/${id}`).subscribe({
      next: job => { this.job.set(job); if (job.status === 'completed' || job.status === 'failed') { clearInterval(this.poll); this.poll = undefined; } },
      error: () => { clearInterval(this.poll); this.poll = undefined; this.error.set({ key: 'error.polling' }); },
    }), 750);
  }

  ngOnDestroy() { if (this.poll) clearInterval(this.poll); if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!); }
}
