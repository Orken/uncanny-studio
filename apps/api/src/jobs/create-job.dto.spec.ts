import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateJobDto } from './create-job.dto';

describe('CreateJobDto timing validation', () => {
  it.each([8, 20, 60, 76])('accepts proportional timings for a %s-second video', total => {
    const dto = plainToInstance(CreateJobDto, {
      start: String(total / 4), duration: String(total / 2), intensity: '75',
    });
    expect(validateSync(dto)).toEqual([]);
  });

  it.each([0, 0.00004, 0.5, -1, NaN, Infinity])('rejects invalid transition duration %s', duration => {
    const dto = plainToInstance(CreateJobDto, { start: 5, duration });
    expect(validateSync(dto).some(error => error.property === 'duration')).toBe(true);
  });

  it('rejects a negative start', () => {
    const dto = plainToInstance(CreateJobDto, { start: -1, duration: 10 });
    expect(validateSync(dto).some(error => error.property === 'start')).toBe(true);
  });
});

describe('CreateJobDto music option', () => {
  it.each(['none', 'over', 'crossfade', 'replace'])('accepts the %s mode', music => {
    expect(validateSync(plainToInstance(CreateJobDto, { start: 2, duration: 4, music }))).toEqual([]);
  });

  it('defaults to no music', () => {
    expect(plainToInstance(CreateJobDto, { start: 2, duration: 4 }).music).toBe('none');
  });

  it('rejects an unknown mode', () => {
    const dto = plainToInstance(CreateJobDto, { start: 2, duration: 4, music: 'true' });
    expect(validateSync(dto).some(error => error.property === 'music')).toBe(true);
  });
});
