// Rendu WebGL des formes : chaque polygone est triangulé, puis le fragment
// shader calcule la coordonnée de texture via une homographie inverse
// (scène → carré unité), ce qui donne une vraie déformation en perspective.

import { bbox, IDENTITY, invert3, mul3, squareToQuad, triangulate, type Mat3, type Pt } from './geometry';

export type Fit = 'warp' | 'cover' | 'stretch';

export interface RenderShape {
  points: Pt[];
  sourceId: string | null;
  fit: Fit;
  opacity: number;
}

export interface RenderSource {
  el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
}

const VERT = `
attribute vec2 aP;
varying vec2 vP;
void main() {
  vP = aP;
  gl_Position = vec4(aP.x * 2.0 - 1.0, 1.0 - aP.y * 2.0, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vP;
uniform mat3 uInv;
uniform sampler2D uTex;
uniform float uOpacity;
void main() {
  vec3 q = uInv * vec3(vP, 1.0);
  vec2 uv = q.xy / q.z;
  if (q.z <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  vec3 c = texture2D(uTex, uv).rgb;
  gl_FragColor = vec4(c * uOpacity, uOpacity);
}`;

function sourceSize(el: RenderSource['el']): { w: number; h: number } {
  if (el instanceof HTMLVideoElement) return { w: el.videoWidth, h: el.videoHeight };
  if (el instanceof HTMLImageElement) return { w: el.naturalWidth, h: el.naturalHeight };
  return { w: el.width, h: el.height };
}

/** Homographie scène → UV pour une forme. */
export function shapeToUv(shape: RenderShape, stageAspect: number, srcAspect: number): Mat3 | null {
  const pts = shape.points;
  if (shape.fit === 'warp' && pts.length === 4) {
    return invert3(squareToQuad(pts));
  }
  const b = bbox(pts);
  const toBox: Mat3 = [1 / b.w, 0, -b.minX / b.w, 0, 1 / b.h, -b.minY / b.h, 0, 0, 1];
  if (shape.fit === 'stretch' || !srcAspect) return toBox;

  // cover : on recadre la source pour garder ses proportions
  const boxAspect = (b.w * stageAspect) / b.h;
  let sx = 1, sy = 1;
  if (srcAspect > boxAspect) sx = boxAspect / srcAspect;
  else sy = srcAspect / boxAspect;
  const crop: Mat3 = [sx, 0, 0.5 - 0.5 * sx, 0, sy, 0.5 - 0.5 * sy, 0, 0, 1];
  return mul3(crop, toBox);
}

export class MappingRenderer {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private aP: number;
  private uInv: WebGLUniformLocation | null;
  private uTex: WebGLUniformLocation | null;
  private uOpacity: WebGLUniformLocation | null;
  private textures = new Map<string, { tex: WebGLTexture; el: RenderSource['el']; uploaded: boolean }>();

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: true });
    if (!gl) throw new Error('WebGL non disponible dans ce navigateur');
    this.gl = gl;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    this.prog = prog;
    this.buf = gl.createBuffer()!;
    this.aP = gl.getAttribLocation(prog, 'aP');
    this.uInv = gl.getUniformLocation(prog, 'uInv');
    this.uTex = gl.getUniformLocation(prog, 'uTex');
    this.uOpacity = gl.getUniformLocation(prog, 'uOpacity');
  }

  private textureFor(id: string, el: RenderSource['el']) {
    const gl = this.gl;
    let entry = this.textures.get(id);
    if (entry && entry.el !== el) {
      gl.deleteTexture(entry.tex);
      entry = undefined;
    }
    if (!entry) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      entry = { tex, el, uploaded: false };
      this.textures.set(id, entry);
    }
    return entry;
  }

  /** Envoie l'image courante au GPU. Retourne false si la source n'est pas prête. */
  private upload(id: string, el: RenderSource['el'], uploadedThisFrame: Set<string>): WebGLTexture | null {
    const gl = this.gl;
    const entry = this.textureFor(id, el);
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    if (uploadedThisFrame.has(id)) return entry.tex;

    const isVideo = el instanceof HTMLVideoElement;
    if (isVideo && el.readyState < 2) return entry.uploaded ? entry.tex : null;
    if (el instanceof HTMLImageElement && !el.complete) return null;
    if (isVideo || !entry.uploaded) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      entry.uploaded = true;
    }
    uploadedThisFrame.add(id);
    return entry.tex;
  }

  forget(id: string) {
    const entry = this.textures.get(id);
    if (entry) {
      this.gl.deleteTexture(entry.tex);
      this.textures.delete(id);
    }
  }

  render(shapes: RenderShape[], sources: Map<string, RenderSource>) {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uTex, 0);

    const stageAspect = width / height;
    const uploaded = new Set<string>();

    for (const shape of shapes) {
      if (!shape.sourceId || shape.points.length < 3) continue;
      const src = sources.get(shape.sourceId);
      if (!src) continue;
      const tex = this.upload(shape.sourceId, src.el, uploaded);
      if (!tex) continue;

      const { w, h } = sourceSize(src.el);
      const m = shapeToUv(shape, stageAspect, h ? w / h : 0) ?? IDENTITY;
      // GLSL attend du column-major
      gl.uniformMatrix3fv(this.uInv, false, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
      gl.uniform1f(this.uOpacity, shape.opacity);

      const tris = triangulate(shape.points);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tris), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aP);
      gl.vertexAttribPointer(this.aP, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, tris.length / 2);
    }
  }
}

/** Mire de calibration : grille + numéros de coins (1→4 = ordre des points). */
export function createTestPattern(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 900;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#2dd4a7';
  ctx.lineWidth = 2;
  for (let x = 0; x <= c.width; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 100) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(c.width, c.height); ctx.moveTo(c.width, 0); ctx.lineTo(0, c.height); ctx.stroke();
  ctx.beginPath(); ctx.arc(c.width / 2, c.height / 2, 300, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 90px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const corners: [string, number, number][] = [
    ['1', 80, 80], ['2', c.width - 80, 80], ['3', c.width - 80, c.height - 80], ['4', 80, c.height - 80],
  ];
  for (const [n, x, y] of corners) ctx.fillText(n, x, y);
  ctx.font = 'bold 60px sans-serif';
  ctx.fillText('▲ HAUT', c.width / 2, 120);
  return c;
}
