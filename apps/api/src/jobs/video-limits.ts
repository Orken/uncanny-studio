import { BadRequestException } from '@nestjs/common';

/** Below this, the three phases (normal, transition, solarized) are too short for the effect to build up. */
export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 76;
export const MIN_TRANSITION_SECONDS = 1;

export interface Timings { start: number; duration: number }

/**
 * Checks the real video duration (ffprobe) and brings the transition back within bounds.
 * The end is clamped rather than rejected: the duration read by the browser is often a few milliseconds off.
 * Errors carry a stable `code` and `params` so the web client can translate them.
 */
export function fitTimings(videoDuration: number, { start, duration }: Timings): Timings {
  if (videoDuration < MIN_VIDEO_SECONDS || videoDuration > MAX_VIDEO_SECONDS) {
    throw new BadRequestException({
      code: 'video_duration',
      message: `The video must be between ${MIN_VIDEO_SECONDS} and ${MAX_VIDEO_SECONDS} s long (got ${videoDuration.toFixed(1)} s).`,
      params: { min: MIN_VIDEO_SECONDS, max: MAX_VIDEO_SECONDS, duration: Number(videoDuration.toFixed(1)) },
    });
  }
  if (start > videoDuration - MIN_TRANSITION_SECONDS) {
    throw new BadRequestException({
      code: 'effect_too_late',
      message: `The effect must start at least ${MIN_TRANSITION_SECONDS} s before the end of the video.`,
      params: { min: MIN_TRANSITION_SECONDS },
    });
  }
  return { start, duration: Math.min(duration, videoDuration - start) };
}
