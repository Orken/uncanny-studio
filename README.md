# Uncanny Studio

🇫🇷 Français · 🇬🇧 [English](#english)

Application Angular + NestJS qui transforme une vidéo avec FFmpeg. Pendant la transition, tout se dérègle progressivement :

- **Image** : la couleur se retire en virant au verdâtre, les ombres se ferment, le contraste monte et la lumière vacille de façon irrégulière ; une vignette se referme.
- **Caméra** : lente poussée vers l'avant, cadre qui se déforme de façon asymétrique et brefs sursauts imprévisibles.
- **Solarisation** : les hautes lumières basculent, les mouvements laissent des traînées, les contours se dédoublent et le grain envahit l'image.
- **Son** : chaque piste descend d'un ton et part dans l'écho, un grondement sourd monte en dessous (sortie stéréo 48 kHz). Toutes les pistes audio de la source sont conservées.
- **Musique (option)** : la piste son de « Musique », au choix mixée **par-dessus** le son de la vidéo, en **cross fade** (le son de la vidéo s'efface pendant que la musique monte, sur toute la durée, à puissance constante) ou à la place du son (**remplace**, une seule piste en sortie). Dans tous les cas, la musique se termine par un fondu de 1 à 3 s selon la durée de la vidéo (durée / 25).

La construction du graphe FFmpeg est isolée dans `apps/api/src/jobs/uncanny-filter.ts`, les limites de durée dans `apps/api/src/jobs/video-limits.ts`.

Le rendu se fait côté serveur : la vidéo est envoyée à l'API, qui la traite avec FFmpeg puis propose le résultat au téléchargement.

L'interface est disponible en français et en anglais (bouton FR / EN dans l'en-tête). La langue du navigateur est utilisée par défaut, et le choix est mémorisé. Les textes sont dans `apps/web/src/app/i18n.ts`.

La vidéo doit durer entre 8 et 76 s. Le navigateur le vérifie dès l'import, et l'API le contrôle à nouveau avec ffprobe avant d'accepter le job : une durée hors limites ou un début d'effet à moins d'1 s de la fin renvoie une erreur 400.

À l’import, la durée de la vidéo sert à prérégler 25 % de vidéo normale, 50 % de transition et 25 % de vidéo solarisée. Par exemple, pour 20 s : 5 s normales, 10 s de transition, puis 5 s avec l’effet complet. Les timings restent modifiables dans les limites de la vidéo (transition d'1 s minimum). Le navigateur doit pouvoir lire sa durée avant de lancer le rendu.

## Prérequis

- Node.js 20+
- FFmpeg et ffprobe accessibles dans le `PATH`

## Démarrage local

```bash
npm install
npm run dev
```

- Interface : http://localhost:4200
- API : http://localhost:3000/api

En développement, Angular relaie `/api` vers NestJS. Pour tester une compilation complète :

```bash
npm run build
npm test
```

## Docker

```bash
docker compose up --build
```

L'application complète est alors disponible sur http://localhost:3000.

## API

- `POST /api/jobs` — multipart avec `video`, `start`, `duration`, `intensity`, `music` (`none` par défaut, `over`, `crossfade` ou `replace`)
- `GET /api/jobs/:id` — état et progression
- `GET /api/jobs/:id/download` — résultat MP4
- `DELETE /api/jobs/:id` — suppression des fichiers du job

Les messages d'erreur de l'API sont en anglais. Les erreurs que l'interface doit afficher portent en plus un `code` stable (`video_missing`, `video_unreadable`, `video_duration`, `effect_too_late`, `music_unavailable`) et des `params`, que le client web traduit.

Limite par défaut : 250 Mo, configurable avec `MAX_UPLOAD_MB`. La musique est lue depuis `apps/api/assets/music.m4a`, ou depuis le chemin donné par `MUSIC_PATH`. Les fichiers temporaires sont supprimés automatiquement après six heures. Par défaut, CORS est désactivé (même origine) : `CORS_ORIGIN` accepte une liste d'origines séparées par des virgules. Limites de débit par IP : `RATE_LIMIT_PER_MINUTE` (300) et `RATE_LIMIT_UPLOADS_PER_HOUR` (10) ; derrière un reverse proxy, définir `TRUST_PROXY` (par exemple `1`). Rendus simultanés : `MAX_CONCURRENT_RENDERS` (1), délai maximal : `RENDER_TIMEOUT_MINUTES` (30).

## Licence

Code sous licence [MIT](LICENSE). La musique fournie dans `apps/api/assets/` n'est pas couverte par cette licence.

---

## English

Angular + NestJS application that transforms a video with FFmpeg. During the transition, everything gradually goes wrong:

- **Image**: color drains away into a greenish tint, shadows close in, contrast rises and the light flickers irregularly; a vignette closes in.
- **Camera**: slow push forward, asymmetrically warping frame and brief, unpredictable jolts.
- **Solarization**: highlights flip, motion leaves trails, edges double up and grain takes over the image.
- **Sound**: every track drops in pitch and dissolves into echo, while a low rumble rises underneath (stereo 48 kHz output). All audio tracks from the source are kept.
- **Music (optional)**: the bundled music track, either mixed **over** the video's sound (**Overlay**), as a **Crossfade** (the video's sound fades out while the music rises, over the whole duration, at constant power), or in place of the sound (**Replace**, a single output track). In every case, the music ends with a 1 to 3 s fade-out depending on the video's duration (duration / 25).

The FFmpeg graph construction lives in `apps/api/src/jobs/uncanny-filter.ts`, and the duration limits in `apps/api/src/jobs/video-limits.ts`.

Rendering happens server-side: the video is uploaded to the API, which processes it with FFmpeg and then offers the result for download.

The interface is available in French and English (FR / EN button in the header). The browser language is used by default, and the choice is remembered. Strings live in `apps/web/src/app/i18n.ts`.

The video must be between 8 and 76 s long. The browser checks this on import, and the API checks it again with ffprobe before accepting the job: an out-of-range duration or an effect start less than 1 s from the end returns a 400 error.

On import, the video's duration is used to preset 25 % normal video, 50 % transition and 25 % solarized video. For example, for 20 s: 5 s normal, 10 s of transition, then 5 s with the full effect. Timings remain editable within the video's bounds (1 s minimum transition). The browser must be able to read the video's duration before starting the render.

### Requirements

- Node.js 20+
- FFmpeg and ffprobe available in the `PATH`

### Local development

```bash
npm install
npm run dev
```

- Interface: http://localhost:4200
- API: http://localhost:3000/api

In development, Angular proxies `/api` to NestJS. To test a full build:

```bash
npm run build
npm test
```

### Docker

```bash
docker compose up --build
```

The full application is then available at http://localhost:3000.

### API

- `POST /api/jobs` — multipart with `video`, `start`, `duration`, `intensity`, `music` (`none` by default, `over`, `crossfade` or `replace`)
- `GET /api/jobs/:id` — status and progress
- `GET /api/jobs/:id/download` — MP4 result
- `DELETE /api/jobs/:id` — deletes the job's files

API error messages are in English. Errors the interface needs to display also carry a stable `code` (`video_missing`, `video_unreadable`, `video_duration`, `effect_too_late`, `music_unavailable`) and `params`, which the web client translates.

Default limit: 250 MB, configurable with `MAX_UPLOAD_MB`. Music is read from `apps/api/assets/music.m4a`, or from the path given by `MUSIC_PATH`. Temporary files are deleted automatically after six hours. CORS is off by default (same origin): `CORS_ORIGIN` takes a comma-separated list of origins. Per-IP rate limits: `RATE_LIMIT_PER_MINUTE` (300) and `RATE_LIMIT_UPLOADS_PER_HOUR` (10); behind a reverse proxy, set `TRUST_PROXY` (e.g. `1`). Concurrent renders: `MAX_CONCURRENT_RENDERS` (1), render timeout: `RENDER_TIMEOUT_MINUTES` (30).

### License

Code under the [MIT](LICENSE) license. The music provided in `apps/api/assets/` is not covered by this license.
