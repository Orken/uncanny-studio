import { BadRequestException } from '@nestjs/common';
import { fitTimings } from './video-limits';

describe('fitTimings', () => {
  it.each([7.9, 76.5])('rejects a %s-second video', duration => {
    expect(() => fitTimings(duration, { start: 2, duration: 4 })).toThrow('The video must be between 8 and 76 s long');
  });

  it('gives the web client a code and params to translate', () => {
    expect.assertions(1);
    try { fitTimings(5, { start: 1, duration: 2 }); } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'video_duration', params: { min: 8, max: 76, duration: 5 } });
    }
  });

  it('accepts the bounds', () => {
    expect(fitTimings(8, { start: 2, duration: 4 })).toEqual({ start: 2, duration: 4 });
    expect(fitTimings(76, { start: 19, duration: 38 })).toEqual({ start: 19, duration: 38 });
  });

  it('clamps a transition that overshoots the end', () => {
    expect(fitTimings(75.12, { start: 18.78, duration: 56.4 })).toEqual({ start: 18.78, duration: 75.12 - 18.78 });
  });

  it('rejects an effect starting too close to the end', () => {
    expect(() => fitTimings(20, { start: 19.5, duration: 1 })).toThrow('at least 1 s before the end');
    expect(() => fitTimings(20, { start: 500, duration: 10 })).toThrow('at least 1 s before the end');
  });
});
