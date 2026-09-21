export interface VideoInfo {
  duration: number;
  /** Displayed width, rotation included: the width of the frames the filters actually receive. */
  width: number;
  fps: number;
  audioTracks: number;
}

/**
 * Music read from the second FFmpeg input (looped):
 * - over: mixed on top of the video's sound;
 * - crossfade: the video's sound fades out while the music fades in, over the whole video;
 * - replace: the music replaces the video's sound (a single output track).
 */
export const MUSIC_MODES = ['none', 'over', 'crossfade', 'replace'] as const;
export type MusicMode = typeof MUSIC_MODES[number];

export interface UncannyOptions {
  start: number;
  duration: number;
  intensity: number; // 0..1
  music: MusicMode;
}

export interface UncannyGraph {
  filter: string;
  /** One output per audio track, in source order. */
  audio: string[];
}

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  side_data_list?: { rotation?: number }[];
  tags?: { rotate?: string };
}

interface ProbeOutput {
  format?: { duration?: string };
  streams?: ProbeStream[];
}

/** "num/den" frame rate; undefined when unknown or absurd (r_frame_rate can be 90000/1). */
const frameRate = (value?: string) => {
  const [num, den] = (value ?? '').split('/').map(Number);
  const fps = num / den;
  return fps > 0 && fps <= 120 ? fps : undefined;
};

/** Reads ffprobe's JSON output; undefined when the video cannot be used. */
export function parseProbe(json: string): VideoInfo | undefined {
  const data = JSON.parse(json) as ProbeOutput;
  const duration = Number(data.format?.duration);
  const video = data.streams?.find(s => s.codec_type === 'video');
  if (!video || !(duration > 0)) return undefined;
  const rotation = Number(video.side_data_list?.find(d => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0);
  const width = Math.abs(rotation) % 180 === 90 ? video.height : video.width;
  return {
    duration,
    width: width && width > 0 ? width : 1280,
    fps: frameRate(video.avg_frame_rate) ?? frameRate(video.r_frame_rate) ?? 30,
    audioTracks: data.streams!.filter(s => s.codec_type === 'audio').length,
  };
}

/** Music fade-out: 1 s for a short clip, up to 3 s for the longest ones. */
export const musicFadeSeconds = (videoDuration: number) => Math.min(3, Math.max(1, videoDuration / 25));

const f = (n: number, digits = 4) => n.toFixed(digits);

/** Transition progress 0→1, for the given time variable (t, T…). */
const progress = (o: UncannyOptions, time: string) => `clip((${time}-${f(o.start)})/${f(o.duration)},0,1)`;

/** Deterministic pseudo-random value from an integer: identical from one expression to the next. */
const hash = (n: string) => `(sin((${n})*12.9898)*43758.5453-floor(sin((${n})*12.9898)*43758.5453))`;

/** Enables a filter from the given time on; before that, frames pass through untouched. */
const from = (seconds: number) => `enable='gte(t,${f(seconds)})'`;

export function buildUncannyFilter(o: UncannyOptions, info: VideoInfo): UncannyGraph {
  const k = o.intensity;
  const p = progress(o, 't');
  const fps = f(info.fps, 3);
  const solarStart = o.start + o.duration * 0.65;
  const solarDuration = o.duration * 0.35;

  // 1. Colour drains away into a sickly green, shadows close in, contrast rises,
  //    the light flickers irregularly.
  const residual = f(0.18 - 0.1 * k, 3);
  const contrast = 1.25 + k * 1.25;
  const brightness = -0.05 - k * 0.20;
  const gamma = 1 - k * 0.38;
  const flicker = `${p}*${f(0.08 * k)}*max(0,sin(t*11.3)*sin(t*4.7)*sin(t*2.3))`;
  const grade = [
    `hue=H='${p}*${f(0.5 + 0.4 * k, 3)}':s='1-(1-${residual})*${p}':${from(o.start)}`,
    `eq=contrast='1+${f(contrast - 1)}*${p}':brightness='${f(brightness)}*${p}-${flicker}':gamma='1+${f(gamma - 1)}*${p}':eval=frame:${from(o.start)}`,
  ].join(',');

  // 2. Solarized branch: highlights flip, movements leave trails,
  //    edges split (chromatic aberration) and grain takes over the picture.
  //    trim cuts the branch while it is transparent: overlay then passes the main picture through.
  const curve = `0/0 0.18/${f(0.05 * (1 - k), 3)} 0.42/${f(0.25 - 0.12 * k, 3)} 0.58/${f(0.75 + 0.25 * k, 3)} 0.76/${f(0.35 - 0.25 * k, 3)} 1/0`;
  const shift = Math.max(1, Math.round((info.width / 640) * (1 + 2 * k)));
  const solar = [
    `trim=start=${f(solarStart)}`,
    `curves=m='${curve}'`,
    `lagfun=decay=${f(0.86 + 0.08 * k, 3)}`,
    `rgbashift=rh=-${shift}:bh=${shift}:edge=smear`,
    `vignette=angle=${f(0.7 + 0.4 * k)}`,
    `format=yuv420p`,
    `noise=alls=${Math.round(8 + 14 * k)}:allf=t`,
    `format=yuva420p`,
    `fade=t=in:st=${f(solarStart)}:d=${f(solarDuration)}:alpha=1`,
  ].join(',');

  // 3. A vignette closes in during the transition. Fades go through the alpha channel
  //    (computed per frame): a per-pixel blend expression would be several times slower.
  const vignette = `trim=start=${f(o.start)},vignette=angle=${f(0.55 + 0.35 * k)},format=yuva420p,fade=t=in:st=${f(o.start)}:d=${f(o.duration * 0.65)}:alpha=1`;

  // 4. Camera: slow push-in, asymmetrically warping frame and brief, unpredictable twitches.
  //    perspective does not expose time, so it is derived from the frame index:
  //    the fps filter at the head of the chain guarantees index / fps = t, even for a variable frame rate source.
  //    Each corner is an independent expression: the eased progress (0) and the twitch (1)
  //    are computed once there, then read back with ld().
  const tf = `(in/${fps})`;
  const eased = `st(0,${progress(o, tf)});st(0,ld(0)*ld(0)*(3-2*ld(0)))`;
  const twitch = `st(1,ld(0)*${f(0.012 * k)}*gt(${hash('in')},0.965))`;
  const zoom = f(0.04 + 0.08 * k);
  const drift = f(0.006 * k);
  const corner = (side: 'W' | 'H', sign: 1 | -1, phase: number) => {
    const offset = `(ld(0)*${zoom}+ld(0)*${drift}*sin(${tf}*${f(0.4 + phase * 0.17, 2)}+${phase}))`;
    const base = sign === 1 ? `${side}*${offset}` : `${side}-${side}*${offset}`;
    const jitter = `ld(1)*(${hash(side === 'W' ? 'in+7' : 'in+13')}-0.5)`;
    return `'${eased};${twitch};${base}+${side}*${jitter}'`;
  };
  const camera = [
    `x0=${corner('W', 1, 0)}`, `y0=${corner('H', 1, 1)}`,
    `x1=${corner('W', -1, 2)}`, `y1=${corner('H', 1, 3)}`,
    `x2=${corner('W', 1, 4)}`, `y2=${corner('H', -1, 5)}`,
    `x3=${corner('W', -1, 6)}`, `y3=${corner('H', -1, 7)}`,
  ].join(':');

  // Sharpening cannot be ramped: it kicks in once the colour drift is under way, which masks it.
  const video = [
    `[0:v]fps=${fps},${grade},split=3[clean][tovignette][tosolar]`,
    `[tovignette]${vignette}[vignette]`,
    `[tosolar]${solar}[solar]`,
    `[clean][vignette]overlay[dark]`,
    `[dark][solar]overlay,perspective=${camera}:eval=frame:${from(o.start)},unsharp=5:5:${f(0.5 + k, 2)}:${from(o.start + o.duration * 0.25)},format=yuv420p[v]`,
  ];

  const music = o.music !== 'none';
  const sourceTracks = o.music === 'replace' ? 0 : info.audioTracks;
  const outputs = Math.max(sourceTracks, music ? 1 : 0);
  if (!outputs) return { filter: video.join(';'), audio: [] };

  const stereo = 'aformat=sample_rates=48000:channel_layouts=stereo';
  const audio: string[] = [];
  // Constant-power crossfade (cos/sin): no volume dip in the middle of the video.
  const along = `PI/2*t/${f(info.duration, 3)}`;

  // Music: looped on input, trimmed to the video duration, then faded out.
  if (music) {
    const fade = musicFadeSeconds(info.duration);
    const labels = Array.from({ length: outputs }, (_, i) => `[music${i}]`).join('');
    const gain = o.music === 'crossfade' ? `volume='0.8*sin(${along})':eval=frame` : 'volume=0.8';
    audio.push(`[1:a]aresample=48000,${stereo},atrim=duration=${f(info.duration, 3)},asetpts=PTS-STARTPTS,${gain},afade=t=out:st=${f(info.duration - fade, 3)}:d=${f(fade, 3)},asplit=${outputs}${labels}`);
  }

  // Sound: each track drops in pitch and drifts into echo, a low rumble rises underneath.
  const rate = 0.92 - 0.12 * k;
  for (let i = 0; i < outputs; i++) {
    const layers: string[] = [];
    if (i < sourceTracks) {
      const fadeOut = o.music === 'crossfade' ? `,volume='cos(${along})':eval=frame` : '';
      audio.push(
        `[0:a:${i}]aresample=48000,${stereo},asplit=2[dry${i}][wet${i}]`,
        `[dry${i}]volume='1-${p}':eval=frame[dryv${i}]`,
        `[wet${i}]asetrate=${Math.round(48000 * rate)},aresample=48000,atempo=${f(1 / rate)},lowpass=f=${Math.round(5200 - 2800 * k)},aecho=0.8:0.6:90|230:${f(0.25 + 0.2 * k, 2)}|${f(0.15 + 0.15 * k, 2)},volume='${p}':eval=frame[wetv${i}]`,
        `anoisesrc=color=brown:amplitude=1:sample_rate=48000:d=${f(info.duration, 3)},lowpass=f=90,${stereo},volume='${f(0.35 * k, 3)}*${p}':eval=frame[drone${i}]`,
        `[dryv${i}][wetv${i}][drone${i}]amix=inputs=3:duration=first:normalize=0${fadeOut}[source${i}]`,
      );
      layers.push(`[source${i}]`);
    }
    if (music) layers.push(`[music${i}]`);
    audio.push(`${layers.join('')}amix=inputs=${layers.length}:duration=first:normalize=0,alimiter=limit=0.95[a${i}]`);
  }
  return { filter: [...video, ...audio].join(';'), audio: Array.from({ length: outputs }, (_, i) => `[a${i}]`) };
}
