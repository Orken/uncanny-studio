import { Injectable, signal } from '@angular/core';

export type Lang = 'fr' | 'en';
export type Params = Record<string, string | number>;

const fr = {
  'brand.home': 'Accueil Uncanny Studio',
  'lang.label': 'Langue',
  'intro': 'Du réel à l’étrange en quelques secondes. Couleur qui se vide, lumière qui vacille, caméra qui glisse, solarisation et son qui se dérègle — rendu image par image par FFmpeg.',
  'drop.title': 'Dépose ta vidéo ici',
  'drop.browse': 'ou clique pour parcourir',
  'drop.limits': 'MP4, MOV, WEBM, MKV · {min} à {max} s · 250 Mo max',
  'file.size': '{size} Mo',
  'summary.video': 'Vidéo : {duration} s',
  'summary.phases': 'Normale : {normal} s · Transition : {transition} s · Solarisée : {solarized} s',
  'summary.reading': 'Lecture de la durée…',
  'controls.title': 'RÉGLAGES DE MUTATION',
  'controls.reset': 'Recommencer',
  'controls.start': 'Début de l’effet',
  'controls.transition': 'Durée de transition',
  'controls.intensity': 'Intensité',
  'music.title': 'Musique',
  'music.fade': 'fondu {seconds} s',
  'music.none': 'Aucune',
  'music.over': 'Par-dessus',
  'music.crossfade': 'Cross fade',
  'music.replace': 'Remplace',
  'render.start': 'GÉNÉRER LE MALAISE',
  'render.processing': 'TRAITEMENT EN COURS',
  'render.hint': 'FFmpeg analyse chaque image…',
  'render.download': 'TÉLÉCHARGER LE RENDU',
  'render.failed': 'Le traitement a échoué.',
  'render.again': 'NOUVEAU RENDU',
  'upload.progress': 'Envoi… {percent} %',
  'steps.label': 'Étapes de l’effet',
  'steps.drain': 'La couleur se retire et tourne au verdâtre, la lumière se met à vaciller.',
  'steps.drift': 'Les ombres se ferment, la caméra avance lentement, le cadre se déforme et sursaute.',
  'steps.solarize': 'Les hautes lumières basculent, les gestes laissent des traînées, les voix descendent dans l’écho.',
  'error.not_video': 'Choisis un fichier vidéo.',
  'error.metadata': 'Impossible de lire la durée de cette vidéo. Essaie un autre fichier ou un format lisible par le navigateur.',
  'error.upload': 'Impossible d’envoyer la vidéo.',
  'error.polling': 'Le suivi du rendu a été interrompu.',
  // Codes returned by the API (see apps/api/src/jobs).
  'error.video_duration': 'La vidéo doit durer entre {min} et {max} s (celle-ci dure {duration} s).',
  'error.effect_too_late': 'L’effet doit commencer au moins {min} s avant la fin de la vidéo.',
  'error.video_missing': 'Vidéo absente ou format non accepté.',
  'error.video_unreadable': 'Vidéo illisible.',
  'error.music_unavailable': 'Musique indisponible sur le serveur.',
};

export type MessageKey = keyof typeof fr;

const en: Record<MessageKey, string> = {
  'brand.home': 'Uncanny Studio home',
  'lang.label': 'Language',
  'intro': 'From real to uncanny in a few seconds. Colour draining away, flickering light, drifting camera, solarization and sound coming apart — rendered frame by frame by FFmpeg, on the server.',
  'drop.title': 'Drop your video here',
  'drop.browse': 'or click to browse',
  'drop.limits': 'MP4, MOV, WEBM, MKV · {min} to {max} s · 250 MB max',
  'file.size': '{size} MB',
  'summary.video': 'Video: {duration} s',
  'summary.phases': 'Normal: {normal} s · Transition: {transition} s · Solarized: {solarized} s',
  'summary.reading': 'Reading duration…',
  'controls.title': 'MUTATION SETTINGS',
  'controls.reset': 'Start over',
  'controls.start': 'Effect start',
  'controls.transition': 'Transition length',
  'controls.intensity': 'Intensity',
  'music.title': 'Music',
  'music.fade': '{seconds} s fade-out',
  'music.none': 'None',
  'music.over': 'Overlay',
  'music.crossfade': 'Crossfade',
  'music.replace': 'Replace',
  'render.start': 'MAKE IT UNCANNY',
  'render.processing': 'PROCESSING',
  'render.hint': 'FFmpeg is working through every frame…',
  'render.download': 'DOWNLOAD THE RENDER',
  'render.failed': 'Rendering failed.',
  'render.again': 'NEW RENDER',
  'upload.progress': 'Uploading… {percent}%',
  'steps.label': 'Effect stages',
  'steps.drain': 'Colour drains away into green and the light starts to flicker.',
  'steps.drift': 'Shadows close in, the camera slowly pushes forward, the frame warps and twitches.',
  'steps.solarize': 'Highlights flip, gestures leave trails, voices sink into the echo.',
  'error.not_video': 'Please choose a video file.',
  'error.metadata': 'Could not read this video’s duration. Try another file or a format your browser can play.',
  'error.upload': 'Could not upload the video.',
  'error.polling': 'Lost track of the render.',
  'error.video_duration': 'The video must be between {min} and {max} s long (this one is {duration} s).',
  'error.effect_too_late': 'The effect must start at least {min} s before the end of the video.',
  'error.video_missing': 'Missing video or unsupported format.',
  'error.video_unreadable': 'Unreadable video.',
  'error.music_unavailable': 'Music is not available on the server.',
};

const dictionaries: Record<Lang, Record<MessageKey, string>> = { fr, en };
const storageKey = 'uncanny-lang';

/** A message kept as a key, so it is translated again when the language changes. */
export type Message = { key: MessageKey; params?: Params } | { text: string };

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(initialLang());

  constructor() { document.documentElement.lang = this.lang(); }

  use(lang: Lang) {
    this.lang.set(lang);
    document.documentElement.lang = lang;
    try { localStorage.setItem(storageKey, lang); } catch { /* storage unavailable: the choice lasts for this visit */ }
  }

  /** Numbers in params are formatted for the current language (decimal comma in French). */
  t(key: MessageKey, params: Params = {}) {
    return dictionaries[this.lang()][key].replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name];
      return typeof value === 'number' ? this.n(value) : String(value ?? '');
    });
  }

  n(value: number, maxDigits = 2, minDigits = 0) {
    return new Intl.NumberFormat(this.lang(), { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }).format(value);
  }

  describe(message: Message) { return 'key' in message ? this.t(message.key, message.params) : message.text; }

  has(key: string): key is MessageKey { return key in fr; }
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* storage unavailable: fall back to the browser language */ }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
