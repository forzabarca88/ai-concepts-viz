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
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
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
  scene.background = new THREE.Color('#0b101f');

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
