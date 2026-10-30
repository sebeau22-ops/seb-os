// Export vidéo : enregistre l'image projetée (canvas WebGL) + le son des
// vidéos non muettes, puis produit un fichier téléchargeable.

const MIME_CANDIDATES = [
  // H.264 en priorité : lisible partout (QuickTime, iPhone, réseaux sociaux)
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function extensionFor(mime: string): string {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/**
 * Mixeur audio : un MediaElementSource ne peut être créé qu'une fois par
 * élément, on les garde donc pour toute la durée de vie du studio.
 * Le son reste audible (→ destination) et part aussi vers l'enregistrement.
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private out: MediaStreamAudioDestinationNode | null = null;
  private connected = new WeakSet<HTMLVideoElement>();

  stream(videos: HTMLVideoElement[]): MediaStream | null {
    try {
      this.ctx ??= new AudioContext();
      this.out ??= this.ctx.createMediaStreamDestination();
      for (const v of videos) {
        if (this.connected.has(v)) continue;
        const src = this.ctx.createMediaElementSource(v);
        src.connect(this.ctx.destination);
        src.connect(this.out);
        this.connected.add(v);
      }
      this.ctx.resume().catch((e) => console.error('[mapping] reprise audio', e));
      return this.out.stream;
    } catch (e) {
      console.error('[mapping] mixage audio indisponible', e);
      return null;
    }
  }
}

export function startRecording(
  canvas: HTMLCanvasElement,
  audio: MediaStream | null,
  mime: string,
  onDone: (blob: Blob) => void,
): MediaRecorder {
  const video = canvas.captureStream(30);
  const tracks = [...video.getVideoTracks(), ...(audio?.getAudioTracks() ?? [])];
  const recorder = new MediaRecorder(new MediaStream(tracks), {
    mimeType: mime,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onerror = (e) => console.error('[mapping] erreur enregistrement', e);
  recorder.onstop = () => {
    for (const t of video.getTracks()) t.stop();
    onDone(new Blob(chunks, { type: mime.split(';')[0] ?? mime }));
  };
  recorder.start(1000);
  return recorder;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
