import * as THREE from 'three';

/**
 * Deterministic PRNG (mulberry32). The single source of randomness for
 * every visualisation — never use `Math.random()` on render/test paths.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Stage3DCameraOptions {
  position?: [number, number, number];
  fov?: number;
}

export interface Stage3DOptions {
  /** Seed for the stage's `rand()`. Keeps the scene deterministic. */
  seed?: number;
  /** Fixed camera. Screenshots must never move it. */
  camera?: Stage3DCameraOptions;
  /**
   * Spin a continuous rAF loop (ambient motion only). Ignored in frozen
   * mode (`<html class="pw">`) and where rAF does not exist (jsdom).
   */
  loop?: boolean;
  /**
   * Transparent canvas: the renderer is created with `alpha: true` and
   * no `scene.background`, so the CSS behind the wrapper shows through.
   * Absent/false keeps the solid `#0b101f` background (default).
   */
  alpha?: boolean;
}

export interface Stage3DHandle {
  /** True when WebGL was unavailable and a `.viz-fallback` note was rendered instead. */
  fallback: boolean;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  /** Deterministic seeded PRNG for this stage. */
  rand: () => number;
  /** Render exactly one frame. Call after every state change. */
  frame(): void;
  /** Dispose the GL context, scene objects and DOM. Safe to call twice. */
  dispose(): void;
}

const DEFAULT_POSITION: [number, number, number] = [0, 0, 10];
const DEFAULT_FOV = 45;

function webglInterfacesExist(): boolean {
  const w = window as unknown as {
    WebGLRenderingContext?: unknown;
    WebGL2RenderingContext?: unknown;
  };
  return (
    typeof w.WebGL2RenderingContext !== 'undefined' ||
    typeof w.WebGLRenderingContext !== 'undefined'
  );
}

/**
 * Create a Three.js stage inside `container`.
 *
 * - Frozen protocol: when `<html>` has class `pw` (the e2e fixture adds
 *   it), no rAF loop is ever started and exactly one frame is rendered
 *   per `frame()` call — state changes call `frame()` themselves.
 * - No WebGL (or jsdom): renders a `.viz-fallback` notice, never throws.
 * - `dispose()` fully releases the context, geometries, materials and
 *   the DOM node.
 *
 * The caller passes a dedicated wrapper element sized by CSS; the canvas
 * fills it.
 */
export function createStage3D(
  container: HTMLElement,
  opts: Stage3DOptions = {},
): Stage3DHandle {
  const rand = mulberry32(opts.seed ?? 1);
  const frozen = document.documentElement.classList.contains('pw');

  const handle: Stage3DHandle = {
    fallback: true,
    scene: null,
    camera: null,
    renderer: null,
    rand,
    frame() {},
    dispose() {},
  };

  if (!webglInterfacesExist()) {
    container.appendChild(createFallbackNote());
    return handle;
  }

  let canvas: HTMLCanvasElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let rafId = 0;
  let disposed = false;

  try {
    canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer(
      opts.alpha
        ? { canvas, antialias: true, powerPreference: 'high-performance', alpha: true }
        : { canvas, antialias: true, powerPreference: 'high-performance' },
    );
  } catch {
    renderer = null;
  }
  if (renderer && !renderer.getContext()) {
    renderer.dispose();
    renderer = null;
  }
  if (!renderer || !canvas) {
    container.appendChild(createFallbackNote());
    return handle;
  }

  renderer.setPixelRatio(1);
  scene = new THREE.Scene();
  // alpha mode leaves the canvas transparent — the wrapper's CSS shows through.
  if (!opts.alpha) scene.background = new THREE.Color('#0b101f');

  camera = new THREE.PerspectiveCamera(opts.camera?.fov ?? DEFAULT_FOV, 1, 0.1, 100);
  camera.position.fromArray(opts.camera?.position ?? DEFAULT_POSITION);
  camera.lookAt(0, 0, 0);

  const width = container.clientWidth || 960;
  const height = container.clientHeight || 540;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const onResize = () => {
    if (disposed || !renderer || !camera || !canvas) return;
    const w = container.clientWidth || canvas.clientWidth || 960;
    const h = container.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Live resizes re-render; frozen mode only renders via frame().
    if (!frozen && scene) renderer.render(scene, camera);
  };
  window.addEventListener('resize', onResize);

  handle.fallback = false;
  handle.scene = scene;
  handle.camera = camera;
  handle.renderer = renderer;

  handle.frame = () => {
    if (disposed || !renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  };

  handle.dispose = () => {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    scene?.traverse((obj) => {
      const node = obj as {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      node.geometry?.dispose();
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
      else node.material?.dispose();
    });
    renderer?.dispose();
    canvas?.remove();
    canvas = null;
    renderer = null;
    scene = null;
    camera = null;
  };

  handle.frame(); // initial frame — the stage is never left blank

  if (opts.loop && !frozen && typeof requestAnimationFrame === 'function') {
    const tick = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);
      handle.frame();
    };
    rafId = requestAnimationFrame(tick);
  }

  return handle;
}

function createFallbackNote(): HTMLElement {
  const note = document.createElement('div');
  note.className = 'viz-fallback';
  note.setAttribute('role', 'note');
  note.textContent =
    '3D preview needs WebGL — every control still works without it.';
  return note;
}

/* ------------------------------ glow helpers ----------------------------- */

/**
 * A 64×64 radial glow sprite (white core, alpha 1 → transparent edge).
 * Fully procedural — no image assets, no randomness.
 */
export function makeGlowSprite(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Soft, additive-blended point cloud on the glow sprite. `colors`
 * (interleaved 3 floats per point, when given) turns on vertexColors.
 */
export function makeGlowPoints(
  positions: Float32Array,
  colors: Float32Array | null,
  size: number,
  opacity = 1,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: makeGlowSprite(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: !!colors,
    opacity,
  });
  return new THREE.Points(geometry, material);
}

/**
 * Seeded background starfield: `count` points on a spherical shell of
 * `radius`, all one `colorHex`, small fixed size 0.05. Directions come
 * from `handle.rand()` (two calls per point, consumed in order). Added
 * to `handle.scene`; returns null on the fallback path.
 */
export function addStarfield(
  handle: Stage3DHandle,
  count: number,
  radius: number,
  colorHex: string,
): THREE.Points | null {
  if (handle.fallback || !handle.scene) return null;
  const color = new THREE.Color(colorHex);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = handle.rand() * Math.PI * 2;
    const phi = Math.acos(2 * handle.rand() - 1);
    const sinPhi = Math.sin(phi);
    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const stars = makeGlowPoints(positions, colors, 0.05);
  handle.scene.add(stars);
  return stars;
}

/* ------------------------------- stage kit ------------------------------- */

export interface Stage3DKitOptions {
  /** Dedicated sized wrapper, `position:relative` by CSS. The kit owns its stage children. */
  wrapper: HTMLElement;
  /** Passed straight through to `createStage3D` (seed, camera, loop, alpha). */
  stageOpts: Stage3DOptions;
  /** Class for the 2D blit canvas (default `'stage-blit'`). */
  blitClass?: string;
  /** Build the scene on a fresh handle. May return null. */
  build: (h: Stage3DHandle) => unknown | null;
  /** Re-apply current state onto refs (must tolerate null refs). */
  reapply: (refs: unknown | null, h: Stage3DHandle) => void;
}

export interface Stage3DKit {
  /** Current handle — reflects the latest context-loss rebuild. */
  handle: Stage3DHandle;
  /** Current `build()` result — null in fallback/jsdom. */
  refs: unknown | null;
  /** `handle.frame()` + 2D blit of the GL frame into the blit canvas. */
  render(): void;
  /** Removes the window resize listener, disposes the stage and blit DOM. Safe to call twice. */
  dispose(): void;
}

/**
 * Resilient 3D stage: `createStage3D` plus the two patterns every 3D
 * section needs, so stages never hand-roll them —
 *
 *  1. 2D blit: the GL drawing buffer is volatile (`preserveDrawingBuffer:
 *     false`), so every `render()` copies the frame into a persistent 2D
 *     canvas in the wrapper. Screenshots always see the last frame, and
 *     the blit also acts as a barrier — a context loss can never corrupt
 *     already-blitted pixels.
 *  2. Context-loss rebuild: on `webglcontextlost` the stage is disposed
 *     and recreated wholesale (every pixel is seed-derived, so the
 *     rebuild is pixel-identical), then `reapply()` re-applies state.
 *
 * `kit.handle` / `kit.refs` stay current after a rebuild — read them at
 * call time.
 */
export function createStageKit(opts: Stage3DKitOptions): Stage3DKit {
  const blitClass = opts.blitClass ?? 'stage-blit';

  let handle: Stage3DHandle = createStage3D(opts.wrapper, opts.stageOpts);
  let refs: unknown | null = handle.fallback ? null : (opts.build(handle) ?? null);
  // Fallback path: the stage appended a `.viz-fallback` note (the wrapper
  // is dedicated, so it is the last element) — keep it so dispose() can
  // leave the wrapper empty.
  let fallbackNote: HTMLElement | null = handle.fallback
    ? (opts.wrapper.lastElementChild as HTMLElement | null)
    : null;
  opts.reapply(refs, handle);

  let blitCanvas: HTMLCanvasElement | null = null;
  let blitCtx: CanvasRenderingContext2D | null = null;
  let disposed = false;

  const ensureBlit = (): void => {
    if (blitCanvas) return;
    const canvas = document.createElement('canvas');
    canvas.className = blitClass;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    opts.wrapper.appendChild(canvas);
    blitCanvas = canvas;
    blitCtx = canvas.getContext('2d');
  };

  const render = (): void => {
    handle.frame();
    if (handle.fallback) return;
    const gl = handle.renderer?.domElement;
    if (!gl) return;
    if (!blitCanvas) ensureBlit();
    if (!blitCanvas || !blitCtx) return; // 2D ctx unavailable — GL canvas still shows
    if (blitCanvas.width !== gl.width || blitCanvas.height !== gl.height) {
      blitCanvas.width = gl.width;
      blitCanvas.height = gl.height;
    }
    // The GL frame is semi-transparent (alpha canvas, additive glows): clear
    // the previous frame first, or old pixels (e.g. a bright orb from an
    // earlier state) accumulate underneath and never dim away.
    blitCtx.clearRect(0, 0, blitCanvas.width, blitCanvas.height);
    blitCtx.drawImage(gl, 0, 0);
  };

  const wireLost = (h: Stage3DHandle): void => {
    h.renderer?.domElement.addEventListener('webglcontextlost', (event) => {
      if (disposed) return; // the kit is already torn down — never rebuild
      event.preventDefault(); // the old context is being discarded
      h.dispose();
      handle = createStage3D(opts.wrapper, opts.stageOpts);
      refs = handle.fallback ? null : (opts.build(handle) ?? null);
      fallbackNote = handle.fallback
        ? (opts.wrapper.lastElementChild as HTMLElement | null)
        : null;
      opts.reapply(refs, handle);
      render();
      wireLost(handle); // re-wire onto the new GL canvas
    });
  };
  wireLost(handle);

  const onResize = (): void => {
    if (disposed) return;
    render(); // blit repaint after the stage's own resize handling
  };
  window.addEventListener('resize', onResize);

  render(); // initial frame + blit — the stage is never left blank

  return {
    get handle(): Stage3DHandle {
      return handle;
    },
    get refs(): unknown | null {
      return refs;
    },
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('resize', onResize);
      handle.dispose();
      fallbackNote?.remove(); // handle.dispose() is a no-op in fallback
      blitCanvas?.remove();
      fallbackNote = null;
      blitCanvas = null;
      blitCtx = null;
    },
  };
}
