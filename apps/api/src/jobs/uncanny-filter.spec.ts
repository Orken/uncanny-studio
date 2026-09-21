import { buildUncannyFilter, musicFadeSeconds, parseProbe, UncannyOptions, VideoInfo } from './uncanny-filter';

const probe = (streams: object[], duration = '12.5') => JSON.stringify({ format: { duration }, streams });
const info: VideoInfo = { duration: 20, width: 1920, fps: 25, audioTracks: 1 };

describe('parseProbe', () => {
  it('reads duration, width, frame rate and audio tracks', () => {
    expect(parseProbe(probe([
      { codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30000/1001' },
      { codec_type: 'audio' },
      { codec_type: 'audio' },
    ]))).toEqual({ duration: 12.5, width: 1920, fps: 30000 / 1001, audioTracks: 2 });
  });

  it('uses the displayed width of a rotated video', () => {
    const rotated = { codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30/1' };
    expect(parseProbe(probe([{ ...rotated, side_data_list: [{ rotation: -90 }] }]))?.width).toBe(1080);
    expect(parseProbe(probe([{ ...rotated, tags: { rotate: '270' } }]))?.width).toBe(1080);
    expect(parseProbe(probe([{ ...rotated, side_data_list: [{ rotation: 180 }] }]))?.width).toBe(1920);
  });

  it('falls back to r_frame_rate, then to sane defaults', () => {
    expect(parseProbe(probe([{ codec_type: 'video', avg_frame_rate: '0/0', r_frame_rate: '60/1' }]))?.fps).toBe(60);
    expect(parseProbe(probe([{ codec_type: 'video', avg_frame_rate: '0/0', r_frame_rate: '90000/1' }]))).toEqual({ duration: 12.5, width: 1280, fps: 30, audioTracks: 0 });
  });

  it('rejects files without video or duration', () => {
    expect(parseProbe(probe([{ codec_type: 'audio' }]))).toBeUndefined();
    expect(parseProbe(probe([{ codec_type: 'video' }], 'N/A'))).toBeUndefined();
  });
});

describe('musicFadeSeconds', () => {
  it.each([[8, 1], [25, 1], [50, 2], [75, 3], [76, 3]])('fades out a %s-second video over %s s', (duration, fade) => {
    expect(musicFadeSeconds(duration)).toBe(fade);
  });
});

describe('buildUncannyFilter', () => {
  const options: UncannyOptions = { start: 5, duration: 10, intensity: 0.75, music: 'none' };

  it('produces a video and an audio output when the source has sound', () => {
    const graph = buildUncannyFilter(options, info);
    expect(graph.audio).toEqual(['[a0]']);
    expect(graph.filter).toContain('[v]');
    expect(graph.filter).toContain('fade=t=in:st=11.5000:d=3.5000:alpha=1');
  });

  it('forces a constant frame rate so the camera follows real time', () => {
    expect(buildUncannyFilter(options, info).filter).toMatch(/^\[0:v\]fps=25\.000,/);
  });

  it('leaves the frames before the effect untouched', () => {
    const { filter } = buildUncannyFilter(options, info);
    expect(filter).toMatch(/unsharp=[^,;]*enable='gte\(t,7\.5000\)'/);
    expect(filter).toMatch(/perspective=.*:eval=frame:enable='gte\(t,5\.0000\)'/);
    expect(filter).toContain('[tosolar]trim=start=11.5000,');
    expect(filter).toContain('[tovignette]trim=start=5.0000,');
  });

  it('leaves audio out when the source is silent', () => {
    const graph = buildUncannyFilter(options, { ...info, audioTracks: 0 });
    expect(graph.audio).toEqual([]);
    expect(graph.filter).not.toContain('[0:a');
  });

  it('keeps every audio track of the source', () => {
    const graph = buildUncannyFilter(options, { ...info, audioTracks: 2 });
    expect(graph.audio).toEqual(['[a0]', '[a1]']);
    expect(graph.filter).toContain('[0:a:1]');
  });

  it('mixes the music over each track with a fade-out', () => {
    const graph = buildUncannyFilter({ ...options, music: 'over' }, { ...info, audioTracks: 2 });
    expect(graph.filter).toContain('atrim=duration=20.000');
    expect(graph.filter).toContain('afade=t=out:st=19.000:d=1.000');
    expect(graph.filter).toContain('asplit=2[music0][music1]');
    expect(graph.filter).toContain('[source1][music1]amix=inputs=2');
  });

  it('crossfades from the source sound to the music over the whole video', () => {
    const graph = buildUncannyFilter({ ...options, music: 'crossfade' }, info);
    expect(graph.filter).toContain("volume='0.8*sin(PI/2*t/20.000)':eval=frame,afade=t=out");
    expect(graph.filter).toContain("normalize=0,volume='cos(PI/2*t/20.000)':eval=frame[source0]");
  });

  it('drops the source sound when the music replaces it', () => {
    const graph = buildUncannyFilter({ ...options, music: 'replace' }, { ...info, audioTracks: 2 });
    expect(graph.audio).toEqual(['[a0]']);
    expect(graph.filter).toContain('[music0]amix=inputs=1');
    expect(graph.filter).not.toContain('[0:a');
  });

  it('keeps the source at full level when the music is only laid over', () => {
    expect(buildUncannyFilter({ ...options, music: 'over' }, info).filter).not.toContain('cos(');
  });

  it('uses the music alone when the source is silent', () => {
    const graph = buildUncannyFilter({ ...options, music: 'over' }, { ...info, audioTracks: 0 });
    expect(graph.audio).toEqual(['[a0]']);
    expect(graph.filter).toContain('[music0]amix=inputs=1');
    expect(graph.filter).not.toContain('[0:a');
  });

  it('keeps every quote balanced so FFmpeg can parse the graph', () => {
    for (const intensity of [0, 0.5, 1]) {
      const { filter } = buildUncannyFilter({ ...options, intensity, music: 'crossfade' }, info);
      expect(filter.split("'").length % 2).toBe(1);
    }
  });
});
