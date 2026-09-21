import { Type } from 'class-transformer';
import { IsIn, IsNumber, Max, Min } from 'class-validator';
import { MUSIC_MODES, MusicMode } from './uncanny-filter';
import { MIN_TRANSITION_SECONDS } from './video-limits';

export class CreateJobDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  start = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(MIN_TRANSITION_SECONDS)
  duration = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  intensity = 75;

  @IsIn(MUSIC_MODES)
  music: MusicMode = 'none';
}
