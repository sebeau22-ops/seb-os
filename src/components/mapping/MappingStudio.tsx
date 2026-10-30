'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pt } from '@/lib/mapping/geometry';
import { projectOnSegment } from '@/lib/mapping/geometry';
import { AudioMixer, downloadBlob, extensionFor, pickMimeType, startRecording } from '@/lib/mapping/recorder';
import { createTestPattern, MappingRenderer, type Fit, type RenderSource } from '@/lib/mapping/renderer';
import {
  deleteSource, listSources, loadLayout, putSource, saveLayout,
  type Shape, type StoredSource,
} from '@/lib/mapping/storage';

// ── Constantes ───────────────────────────────────────────────────────────────

const ASPECTS: Record<string, number> = { '16:9': 16 / 9, '16:10': 16 / 10, '4:3': 4 / 3, '1:1': 1 };
const RENDER_WIDTH = 1920;
const VIEW_W = 1000;
const GRID_ID = 'grid';
const COLORS = ['#2dd4a7', '#f5a524', '#60a5fa', '#f472b6', '#a78bfa', '#facc15', '#fb7185'];

const FIT_LABELS: Record<Fit, string> = {
  warp: 'Déformer (4 coins)',
  cover: 'Remplir (recadrer)',
  stretch: 'Étirer',
};

interface SourceMeta {
  id: string;
  name: string;
  kind: 'video' | 'image' | 'grid';
  muted: boolean;
}

type Drag =
  | { type: 'vertex'; shapeId: string; index: number }
  | { type: 'shape'; shapeId: string; start: Pt; orig: Pt[] };

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const btn = 'font-mono text-[10px] tracking-[0.15em] uppercase px-3 py-2 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = `${btn} border-ink-2 text-ink-3 hover:text-ink-4 hover:border-ink-3`;
const btnAccent = `${btn} border-accent/50 bg-accent/15 text-accent hover:bg-accent/25`;
const label = 'font-mono text-[9px] tracking-[0.2em] uppercase text-ink-3';
const field = 'w-full bg-ink-1 border border-ink-2 rounded-md px-2 py-1.5 text-[12px] text-ink-4 focus:outline-none focus:border-accent/60';

// ── Composant ────────────────────────────────────────────────────────────────

export default function MappingStudio() {
  const [aspectKey, setAspectKey] = useState('16:9');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [mode, setMode] = useState<'select' | 'draw'>('select');
  const [draft, setDraft] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const [sources, setSources] = useState<SourceMeta[]>([{ id: GRID_ID, name: 'Mire de calibration', kind: 'grid', muted: true }]);
  const [defaultSourceId, setDefaultSourceId] = useState<string>(GRID_ID);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showHandles, setShowHandles] = useState(true);
  const [displayWidth, setDisplayWidth] = useState(800);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ startedAt: number; durationMs: number | null } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef<MappingRenderer | null>(null);
  const sourceElsRef = useRef(new Map<string, RenderSource>());
  const urlsRef = useRef(new Map<string, string>());
  const shapesRef = useRef<Shape[]>([]);
  const dragRef = useRef<Drag | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playingRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mixerRef = useRef(new AudioMixer());

  const aspect = ASPECTS[aspectKey] ?? 16 / 9;
  const viewH = VIEW_W / aspect;
  const handleR = (7 * VIEW_W) / Math.max(displayWidth, 1);
  const selected = shapes.find((s) => s.id === selectedId) ?? null;
  const overlayVisible = !fullscreen || showHandles;

  useEffect(() => {
    shapesRef.current = shapes;
    playingRef.current = playing;
  }, [shapes, playing]);

  // ── Sources média ──────────────────────────────────────────────────────────

  const attachSource = useCallback((stored: StoredSource): SourceMeta => {
    const url = URL.createObjectURL(stored.blob);
    urlsRef.current.set(stored.id, url);
    const isVideo = stored.type.startsWith('video/');
    if (isVideo) {
      const v = document.createElement('video');
      v.src = url;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      if (playingRef.current) {
        v.play().catch((e) => console.error('[mapping] lecture vidéo impossible', stored.name, e));
      }
      sourceElsRef.current.set(stored.id, { el: v });
    } else {
      const img = new Image();
      img.src = url;
      sourceElsRef.current.set(stored.id, { el: img });
    }
    return { id: stored.id, name: stored.name, kind: isVideo ? 'video' : 'image', muted: true };
  }, []);

  // Chargement initial : mire, disposition, médiathèque
  useEffect(() => {
    sourceElsRef.current.set(GRID_ID, { el: createTestPattern() });
    let cancelled = false;
    listSources().then((stored) => {
      if (cancelled) return;
      const layout = loadLayout();
      if (layout) {
        if (ASPECTS[layout.aspect]) setAspectKey(layout.aspect);
        setShapes(layout.shapes ?? []);
      }
      const metas = stored.map(attachSource);
      setSources((prev) => [...prev, ...metas]);
      if (metas.length) setDefaultSourceId(metas[metas.length - 1]!.id);
      setLoaded(true);
    });
    const urls = urlsRef.current;
    const els = sourceElsRef.current;
    return () => {
      cancelled = true;
      for (const { el } of els.values()) if (el instanceof HTMLVideoElement) el.pause();
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [attachSource]);

  // Sauvegarde de la disposition (légèrement différée pendant les glisser)
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => saveLayout({ aspect: aspectKey, shapes }), 300);
    return () => clearTimeout(t);
  }, [shapes, aspectKey, loaded]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const metas: SourceMeta[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
        setError(`Format non supporté : ${file.name}`);
        continue;
      }
      const stored: StoredSource = { id: crypto.randomUUID(), name: file.name, type: file.type, blob: file };
      await putSource(stored);
      metas.push(attachSource(stored));
    }
    if (!metas.length) return;
    setSources((prev) => [...prev, ...metas]);
    setDefaultSourceId(metas[metas.length - 1]!.id);
    // Si une forme est sélectionnée, on lui assigne directement le premier média ajouté
    if (selectedId) updateShape(selectedId, { sourceId: metas[0]!.id });
  }

  async function removeSource(id: string) {
    const entry = sourceElsRef.current.get(id);
    if (entry?.el instanceof HTMLVideoElement) {
      entry.el.pause();
      entry.el.removeAttribute('src');
    }
    sourceElsRef.current.delete(id);
    rendererRef.current?.forget(id);
    const url = urlsRef.current.get(id);
    if (url) URL.revokeObjectURL(url);
    urlsRef.current.delete(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
    setShapes((prev) => prev.map((s) => (s.sourceId === id ? { ...s, sourceId: null } : s)));
    if (defaultSourceId === id) setDefaultSourceId(GRID_ID);
    await deleteSource(id);
  }

  function toggleMute(id: string) {
    const el = sourceElsRef.current.get(id)?.el;
    if (!(el instanceof HTMLVideoElement)) return;
    el.muted = !el.muted;
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, muted: el.muted } : s)));
  }

  function videos(): HTMLVideoElement[] {
    return [...sourceElsRef.current.values()]
      .map((s) => s.el)
      .filter((el): el is HTMLVideoElement => el instanceof HTMLVideoElement);
  }

  const togglePlay = useCallback(() => {
    const next = !playingRef.current;
    for (const v of videos()) {
      if (next) v.play().catch((e) => console.error('[mapping] lecture impossible', e));
      else v.pause();
    }
    setPlaying(next);
  }, []);

  function restartAll() {
    for (const v of videos()) v.currentTime = 0;
  }

  // ── Export vidéo ───────────────────────────────────────────────────────────

  function startExport() {
    const canvas = canvasRef.current;
    if (!canvas || recorderRef.current) return;
    const mime = pickMimeType();
    if (!mime) {
      setError('Ce navigateur ne permet pas d’enregistrer une vidéo. Essayez Chrome, Edge ou Safari récent.');
      return;
    }

    // Durée d'une boucle = la plus longue vidéo projetée dans une forme
    const usedIds = new Set(shapesRef.current.map((s) => s.sourceId));
    const used = [...sourceElsRef.current.entries()]
      .filter(([id, s]) => usedIds.has(id) && s.el instanceof HTMLVideoElement)
      .map(([, s]) => s.el as HTMLVideoElement);
    const longest = Math.max(0, ...used.map((v) => (Number.isFinite(v.duration) ? v.duration : 0)));

    restartAll();
    if (!playingRef.current) togglePlay();

    const all = videos();
    const audio = all.some((v) => !v.muted) ? mixerRef.current.stream(all) : null;
    const ext = extensionFor(mime);

    recorderRef.current = startRecording(canvas, audio, mime, (blob) => {
      const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'America/Toronto' }).replace(/[: ]/g, '-').slice(0, 16);
      downloadBlob(blob, `mapping-${stamp}.${ext}`);
      recorderRef.current = null;
      setRecording(null);
    });
    const durationMs = longest > 0 ? Math.round(longest * 1000) : null;
    if (durationMs) autoStopRef.current = setTimeout(stopExport, durationMs + 150);
    setElapsedMs(0);
    setRecording({ startedAt: performance.now(), durationMs });
  }

  function stopExport() {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsedMs(performance.now() - recording.startedAt), 250);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  // ── Rendu WebGL ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new MappingRenderer(canvas);
    } catch (e) {
      console.error('[mapping] initialisation WebGL échouée', e);
      // Échec ponctuel à l'initialisation : un seul rendu supplémentaire
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('WebGL est indisponible : impossible d’afficher la projection.');
      return;
    }
    let raf = 0;
    const loop = () => {
      rendererRef.current?.render(shapesRef.current, sourceElsRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(([entry]) => entry && setDisplayWidth(entry.contentRect.width));
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // ── Plein écran & fenêtre projecteur ───────────────────────────────────────

  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement === wrapRef.current;
      setFullscreen(fs);
      setShowHandles(!fs);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((e) => console.error('[mapping] sortie plein écran', e));
    } else {
      wrapRef.current?.requestFullscreen().catch((e) => console.error('[mapping] plein écran refusé', e));
    }
  }, []);

  function openProjectorWindow() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const win = window.open('', 'seb-projecteur', 'popup,width=1280,height=720');
    if (!win) {
      setError('La fenêtre a été bloquée : autorisez les pop-ups pour ce site.');
      return;
    }
    streamRef.current ??= canvas.captureStream(60);
    const doc = win.document;
    doc.title = 'Projecteur — Seb OS';
    doc.body.innerHTML = '';
    doc.body.style.cssText = 'margin:0;background:#000;overflow:hidden;cursor:none;';
    const video = doc.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = 'width:100vw;height:100vh;object-fit:contain;display:block;background:#000;';
    video.srcObject = streamRef.current;
    const hint = doc.createElement('div');
    hint.textContent = 'Glissez cette fenêtre sur le projecteur, puis cliquez pour passer en plein écran';
    hint.style.cssText = 'position:fixed;inset:auto 0 24px 0;text-align:center;color:#9ca3af;font:13px system-ui;transition:opacity 1s;';
    doc.body.append(video, hint);
    doc.body.onclick = () => {
      hint.style.opacity = '0';
      doc.documentElement.requestFullscreen().catch((e) => console.error('[mapping] plein écran projecteur', e));
    };
    video.play().catch((e) => console.error('[mapping] flux projecteur', e));
  }

  // ── Édition des formes ─────────────────────────────────────────────────────

  function updateShape(id: string, patch: Partial<Shape> | ((s: Shape) => Partial<Shape>)) {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)));
  }

  function newShape(points: Pt[]): Shape {
    const n = shapesRef.current.length + 1;
    return {
      id: crypto.randomUUID(),
      name: `Forme ${n}`,
      points,
      sourceId: defaultSourceId,
      fit: points.length === 4 ? 'warp' : 'cover',
      opacity: 1,
    };
  }

  function addShape(shape: Shape) {
    setShapes((prev) => [...prev, shape]);
    setSelectedId(shape.id);
    setSelectedVertex(null);
  }

  function addRectangle() {
    addShape(newShape([{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }]));
    setMode('select');
  }

  const finishDraft = useCallback(() => {
    if (draft.length >= 3) addShape(newShape(draft));
    setDraft([]);
    setMode('select');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, defaultSourceId]);

  function startDrawing() {
    setMode('draw');
    setDraft([]);
    setSelectedId(null);
    setSelectedVertex(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setShapes((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
    setSelectedVertex(null);
  }

  function duplicateSelected() {
    if (!selected) return;
    addShape({
      ...selected,
      id: crypto.randomUUID(),
      name: `${selected.name} (copie)`,
      points: selected.points.map((p) => ({ x: clamp01(p.x + 0.03), y: clamp01(p.y + 0.03) })),
    });
  }

  function moveLayer(dir: -1 | 1) {
    if (!selectedId) return;
    setShapes((prev) => {
      const i = prev.findIndex((s) => s.id === selectedId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  // ── Pointeur ───────────────────────────────────────────────────────────────

  function toStage(e: React.PointerEvent | React.MouseEvent): Pt {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) };
  }

  function distView(a: Pt, b: Pt) {
    return Math.hypot((a.x - b.x) * VIEW_W, (a.y - b.y) * viewH);
  }

  function capture(e: React.PointerEvent) {
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onBackgroundDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const p = toStage(e);
    if (mode === 'draw') {
      if (draft.length >= 3 && distView(p, draft[0]!) < handleR * 1.8) finishDraft();
      else setDraft((d) => [...d, p]);
      return;
    }
    setSelectedId(null);
    setSelectedVertex(null);
  }

  function onShapeDown(e: React.PointerEvent, shape: Shape) {
    if (mode === 'draw' || e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(shape.id);
    setSelectedVertex(null);
    dragRef.current = { type: 'shape', shapeId: shape.id, start: toStage(e), orig: shape.points };
    capture(e);
  }

  function onVertexDown(e: React.PointerEvent, shape: Shape, index: number) {
    if (mode === 'draw' || e.button !== 0) return;
    e.stopPropagation();
    if (e.altKey && shape.points.length > 3) {
      updateShape(shape.id, (s) => ({ points: s.points.filter((_, i) => i !== index) }));
      setSelectedVertex(null);
      return;
    }
    setSelectedId(shape.id);
    setSelectedVertex(index);
    dragRef.current = { type: 'vertex', shapeId: shape.id, index };
    capture(e);
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toStage(e);
    if (mode === 'draw') setHover(p);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'vertex') {
      updateShape(drag.shapeId, (s) => ({ points: s.points.map((q, i) => (i === drag.index ? p : q)) }));
    } else {
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      updateShape(drag.shapeId, { points: drag.orig.map((q) => ({ x: q.x + dx, y: q.y + dy })) });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
  }

  // Double-clic sur une forme : insère un point sur l'arête la plus proche
  function onShapeDoubleClick(e: React.MouseEvent, shape: Shape) {
    e.stopPropagation();
    const p = toStage(e);
    let best = { index: 0, pt: p, dist: Infinity };
    shape.points.forEach((a, i) => {
      const b = shape.points[(i + 1) % shape.points.length]!;
      const r = projectOnSegment(p, a, b);
      if (r.dist < best.dist) best = { index: i + 1, pt: r.pt, dist: r.dist };
    });
    updateShape(shape.id, (s) => {
      const pts = [...s.points];
      pts.splice(best.index, 0, best.pt);
      return { points: pts, fit: s.fit === 'warp' ? 'cover' : s.fit };
    });
    setSelectedVertex(best.index);
  }

  // ── Clavier ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;

      if (mode === 'draw') {
        if (e.key === 'Enter') { e.preventDefault(); finishDraft(); }
        else if (e.key === 'Escape') { setDraft([]); setMode('select'); }
        else if (e.key === 'Backspace') { e.preventDefault(); setDraft((d) => d.slice(0, -1)); }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'h') setShowHandles((v) => !v);
      else if (k === 'f') toggleFullscreen();
      else if (k === 'n') startDrawing();
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        const shape = shapesRef.current.find((s) => s.id === selectedId);
        if (shape && selectedVertex !== null && shape.points.length > 3) {
          updateShape(selectedId, (s) => ({ points: s.points.filter((_, i) => i !== selectedVertex) }));
          setSelectedVertex(null);
        } else {
          deleteSelected();
        }
      } else if (e.key.startsWith('Arrow') && selectedId) {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) / RENDER_WIDTH;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) * aspect;
        updateShape(selectedId, (s) => ({
          points: s.points.map((p, i) =>
            selectedVertex === null || i === selectedVertex ? { x: clamp01(p.x + dx), y: clamp01(p.y + dy) } : p),
        }));
      } else if (e.key === 'Tab' && selected) {
        e.preventDefault();
        const n = selected.points.length;
        setSelectedVertex((v) => (v === null ? 0 : (v + (e.shiftKey ? n - 1 : 1)) % n));
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setSelectedVertex(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const stageWidth = fullscreen
    ? `min(100vw, calc(100vh * ${aspect}))`
    : `min(100%, calc((100vh - 10rem) * ${aspect}))`;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* Scène */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className={btnAccent} onClick={() => fileRef.current?.click()}>+ Vidéo / image</button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*,image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <button className={mode === 'draw' ? btnAccent : btnGhost} onClick={mode === 'draw' ? finishDraft : startDrawing}>
            {mode === 'draw' ? `Terminer (${draft.length} pts)` : '✎ Dessiner une forme'}
          </button>
          <button className={btnGhost} onClick={addRectangle}>▭ Rectangle</button>
          <span className="w-px h-6 bg-ink-2 mx-1" />
          <button className={btnGhost} onClick={togglePlay}>{playing ? '❚❚ Pause' : '▶ Lecture'}</button>
          <button className={btnGhost} onClick={restartAll}>↺ Synchro</button>
          <span className="w-px h-6 bg-ink-2 mx-1" />
          <button className={btnGhost} onClick={openProjectorWindow}>⧉ Fenêtre projecteur</button>
          <button className={btnGhost} onClick={toggleFullscreen}>⛶ Plein écran</button>
          {recording ? (
            <button className={`${btn} border-danger/50 bg-danger/15 text-danger hover:bg-danger/25`} onClick={stopExport}>
              ■ Arrêter et télécharger{' '}
              <span className="font-numeric">
                {formatTime(elapsedMs)}{recording.durationMs ? ` / ${formatTime(recording.durationMs)}` : ''}
              </span>
            </button>
          ) : (
            <button
              className={btnGhost}
              onClick={startExport}
              disabled={shapes.length === 0}
              title="Enregistre le résultat projeté (une boucle complète de la vidéo) et le télécharge"
            >
              ⤓ Exporter la vidéo
            </button>
          )}
          <select
            className="bg-ink-1 border border-ink-2 rounded-md px-2 py-1.5 font-mono text-[11px] text-ink-4"
            value={aspectKey}
            onChange={(e) => setAspectKey(e.target.value)}
            title="Format du projecteur"
          >
            {Object.keys(ASPECTS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            <span>{error}</span>
            <button className="font-mono text-[10px]" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div
          ref={wrapRef}
          className={fullscreen ? 'w-screen h-screen bg-black flex items-center justify-center' : 'flex justify-center'}
          style={fullscreen && !showHandles ? { cursor: 'none' } : undefined}
        >
          <div
            className={`relative bg-black ${fullscreen ? '' : 'rounded-md ring-1 ring-ink-2'}`}
            style={{ width: stageWidth, aspectRatio: String(aspect) }}
          >
            <canvas
              ref={canvasRef}
              width={RENDER_WIDTH}
              height={Math.round(RENDER_WIDTH / aspect)}
              className="absolute inset-0 w-full h-full"
            />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${viewH}`}
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full touch-none select-none"
              style={{ cursor: mode === 'draw' ? 'crosshair' : 'default', opacity: overlayVisible ? 1 : 0 }}
              onPointerDown={onBackgroundDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setHover(null)}
              onDoubleClick={() => mode === 'draw' && finishDraft()}
            >
              {shapes.map((shape, si) => {
                const color = COLORS[si % COLORS.length];
                const isSel = shape.id === selectedId;
                const pts = shape.points.map((p) => `${p.x * VIEW_W},${p.y * viewH}`).join(' ');
                return (
                  <g key={shape.id} style={{ pointerEvents: mode === 'draw' ? 'none' : 'auto' }}>
                    <polygon
                      points={pts}
                      fill={isSel ? `${color}22` : 'transparent'}
                      stroke={color}
                      strokeWidth={isSel ? 2 : 1}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={isSel ? undefined : '6 4'}
                      style={{ cursor: 'move' }}
                      onPointerDown={(e) => onShapeDown(e, shape)}
                      onDoubleClick={(e) => onShapeDoubleClick(e, shape)}
                    />
                    {shape.points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x * VIEW_W}
                          cy={p.y * viewH}
                          r={handleR * (isSel ? 1 : 0.7)}
                          fill={isSel && selectedVertex === i ? '#fff' : color}
                          stroke="#000"
                          strokeWidth={1}
                          vectorEffect="non-scaling-stroke"
                          style={{ cursor: 'grab' }}
                          onPointerDown={(e) => onVertexDown(e, shape, i)}
                        />
                        {isSel && shape.fit === 'warp' && shape.points.length === 4 && (
                          <text
                            x={p.x * VIEW_W + handleR * 1.4}
                            y={p.y * viewH - handleR * 1.4}
                            fill="#fff"
                            fontSize={handleR * 2}
                            fontFamily="monospace"
                            style={{ pointerEvents: 'none' }}
                          >
                            {i + 1}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                );
              })}

              {mode === 'draw' && draft.length > 0 && (
                <g style={{ pointerEvents: 'none' }}>
                  <polyline
                    points={[...draft, ...(hover ? [hover] : [])].map((p) => `${p.x * VIEW_W},${p.y * viewH}`).join(' ')}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                  {draft.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x * VIEW_W}
                      cy={p.y * viewH}
                      r={i === 0 && draft.length >= 3 ? handleR * 1.4 : handleR * 0.8}
                      fill={i === 0 ? '#2dd4a7' : '#fff'}
                      stroke="#000"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              )}
            </svg>

            {shapes.length === 0 && mode === 'select' && overlayVisible && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <p className="max-w-md text-center text-[13px] leading-relaxed text-ink-3">
                  Ajoutez une vidéo, puis dessinez le contour de votre objet en cliquant point par point
                  (ou partez d’un rectangle et déplacez ses 4 coins).
                </p>
              </div>
            )}
          </div>
        </div>

        {!fullscreen && (
          <p className="font-mono text-[10px] leading-relaxed text-ink-3">
            {mode === 'draw'
              ? 'DESSIN — clic : ajouter un point · clic sur le 1er point / Entrée / double-clic : fermer · ⌫ : annuler le dernier point · Échap : abandonner'
              : 'Glisser : déplacer coin ou forme · double-clic sur une forme : ajouter un point · Alt+clic : retirer un point · ←↑→↓ (Maj ×10) : ajuster finement · Tab : coin suivant · Suppr : effacer · N : dessiner · Espace : lecture · F : plein écran · H : masquer les repères'}
          </p>
        )}
      </div>

      {/* Panneau latéral */}
      <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
        <section className="rounded-lg border border-ink-2 bg-ink-1 p-3 flex flex-col gap-2">
          <h2 className={label}>Formes ({shapes.length})</h2>
          {shapes.length === 0 && <p className="text-[12px] text-ink-3">Aucune forme pour l’instant.</p>}
          <ul className="flex flex-col gap-1">
            {shapes.map((s, i) => (
              <li key={s.id}>
                <button
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                    s.id === selectedId ? 'bg-accent/15 text-ink-4' : 'text-ink-3 hover:bg-ink-2/50'
                  }`}
                  onClick={() => { setSelectedId(s.id); setSelectedVertex(null); setMode('select'); }}
                >
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="truncate flex-1">{s.name}</span>
                  <span className="font-numeric text-[10px] text-ink-3">{s.points.length} pts</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selected && (
          <section className="rounded-lg border border-ink-2 bg-ink-1 p-3 flex flex-col gap-3">
            <h2 className={label}>Forme sélectionnée</h2>
            <label className="flex flex-col gap-1">
              <span className={label}>Nom</span>
              <input className={field} value={selected.name} onChange={(e) => updateShape(selected.id, { name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Média projeté</span>
              <select
                className={field}
                value={selected.sourceId ?? ''}
                onChange={(e) => updateShape(selected.id, { sourceId: e.target.value || null })}
              >
                <option value="">— Noir (masque) —</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Ajustement</span>
              <select
                className={field}
                value={selected.fit === 'warp' && selected.points.length !== 4 ? 'cover' : selected.fit}
                onChange={(e) => updateShape(selected.id, { fit: e.target.value as Fit })}
              >
                {(Object.keys(FIT_LABELS) as Fit[]).map((f) => (
                  <option key={f} value={f} disabled={f === 'warp' && selected.points.length !== 4}>{FIT_LABELS[f]}</option>
                ))}
              </select>
              {selected.points.length !== 4 && (
                <span className="text-[11px] text-ink-3">La déformation en perspective demande exactement 4 points.</span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className={`${label} flex justify-between`}>
                <span>Luminosité</span>
                <span className="font-numeric">{Math.round(selected.opacity * 100)} %</span>
              </span>
              <input
                type="range" min={0} max={1} step={0.01}
                value={selected.opacity}
                onChange={(e) => updateShape(selected.id, { opacity: Number(e.target.value) })}
                className="accent-[var(--color-accent)]"
              />
            </label>
            {selected.fit === 'warp' && selected.points.length === 4 && (
              <div className="flex gap-2">
                <button
                  className={`${btnGhost} flex-1`}
                  onClick={() => updateShape(selected.id, (s) => ({ points: [...s.points.slice(1), s.points[0]!] }))}
                  title="Faire tourner l’image de 90° dans la forme"
                >
                  ⟳ Pivoter
                </button>
                <button
                  className={`${btnGhost} flex-1`}
                  onClick={() => updateShape(selected.id, (s) => ({ points: [s.points[1]!, s.points[0]!, s.points[3]!, s.points[2]!] }))}
                  title="Retourner l’image horizontalement"
                >
                  ⇋ Miroir
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button className={btnGhost} onClick={() => moveLayer(1)}>↑ Devant</button>
              <button className={btnGhost} onClick={() => moveLayer(-1)}>↓ Derrière</button>
              <button className={btnGhost} onClick={duplicateSelected}>Dupliquer</button>
              <button className={`${btn} border-danger/40 text-danger hover:bg-danger/10`} onClick={deleteSelected}>Supprimer</button>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-ink-2 bg-ink-1 p-3 flex flex-col gap-2">
          <h2 className={label}>Médiathèque</h2>
          <ul className="flex flex-col gap-1">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink-4 hover:bg-ink-2/40">
                <span className="font-mono text-[10px] text-ink-3 w-4">{s.kind === 'video' ? '▶' : s.kind === 'image' ? '▣' : '#'}</span>
                <span className="truncate flex-1" title={s.name}>{s.name}</span>
                {s.kind === 'video' && (
                  <button className="font-mono text-[10px] text-ink-3 hover:text-ink-4" onClick={() => toggleMute(s.id)} title="Son">
                    {s.muted ? '🔇' : '🔊'}
                  </button>
                )}
                {selected && (
                  <button
                    className="font-mono text-[10px] text-accent hover:text-accent-glow"
                    onClick={() => updateShape(selected.id, { sourceId: s.id })}
                    title="Projeter dans la forme sélectionnée"
                  >
                    ↳
                  </button>
                )}
                {s.kind !== 'grid' && (
                  <button className="font-mono text-[10px] text-ink-3 hover:text-danger" onClick={() => removeSource(s.id)} title="Retirer">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-ink-3">
            Les fichiers restent sur cet appareil (stockage du navigateur), rien n’est envoyé en ligne.
          </p>
        </section>

        <section className="rounded-lg border border-ink-2 bg-ink-1 p-3 text-[12px] leading-relaxed text-ink-3">
          <h2 className={`${label} mb-2`}>Mise en place</h2>
          <ol className="list-decimal pl-4 flex flex-col gap-1">
            <li>Branchez le projecteur en écran étendu et choisissez son format ({aspectKey}).</li>
            <li>Cliquez « Fenêtre projecteur », glissez-la sur le projecteur, cliquez-la pour le plein écran.</li>
            <li>Projetez la mire, puis ajustez les coins sur votre écran jusqu’à épouser l’objet.</li>
            <li>Remplacez la mire par votre vidéo.</li>
          </ol>
          <p className="mt-2">Gardez cet onglet ouvert (non réduit) : c’est lui qui calcule l’image envoyée au projecteur.</p>
          <p className="mt-2">
            « Exporter la vidéo » enregistre le résultat en temps réel (une boucle complète, son compris si une vidéo
            n’est pas muette) puis télécharge le fichier. Restez sur cet onglet pendant l’enregistrement.
          </p>
        </section>
      </aside>
    </div>
  );
}
