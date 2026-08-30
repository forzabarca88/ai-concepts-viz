import { beforeEach, describe, expect, it } from 'vitest';
import { createStageKit, mulberry32 } from './helpers';

/** The kit wants a dedicated sized wrapper (position:relative by CSS). */
function makeWrapper(): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = '960px';
  wrapper.style.height = '540px';
  document.body.appendChild(wrapper);
  return wrapper;
}

describe('mulberry32', () => {
  it('emits the fixed sequence for seed 7', () => {
    const rand = mulberry32(7);
    expect([rand(), rand(), rand(), rand(), rand()]).toEqual([
      0.011704753153026104,
      0.06195825757458806,
      0.97690763277933,
      0.6990287057124078,
      0.5214452685322613,
    ]);
  });
});

describe('createStageKit (jsdom — no WebGL)', () => {
  let wrapper: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    wrapper = makeWrapper();
  });

  it('falls back cleanly: note in the wrapper, null refs, safe render/dispose', () => {
    const kit = createStageKit({
      wrapper,
      stageOpts: { seed: 42 },
      build: () => null,
      reapply: () => {},
    });

    expect(wrapper.querySelector('.viz-fallback')).not.toBeNull();
    expect(kit.refs).toBeNull();

    expect(() => kit.render()).not.toThrow();
    expect(() => kit.dispose()).not.toThrow();
    expect(wrapper.childElementCount).toBe(0);
  });

  it('gives two kits with the same seed identical rand() streams', () => {
    const other = makeWrapper();
    const shared = {
      stageOpts: { seed: 20260401 },
      build: () => null,
      reapply: () => {},
    };
    const a = createStageKit({ ...shared, wrapper });
    const b = createStageKit({ ...shared, wrapper: other });

    for (let i = 0; i < 10; i += 1) {
      expect(a.handle.rand()).toBe(b.handle.rand());
    }

    a.dispose();
    b.dispose();
  });
});
