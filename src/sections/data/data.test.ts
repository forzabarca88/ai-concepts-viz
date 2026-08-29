import { afterEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/dom';
import { mountPage } from '../../test/mountPage';
import { page } from './page';

let mounted: ReturnType<typeof mountPage> | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

const mount = () => {
  mounted = mountPage(page);
  return mounted;
};

const fmt = new Intl.NumberFormat('en-US');

/** "Name pct" pair per mix row, e.g. `Books 30%`. */
function mixRows(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('.data-mix-row')].map((row) => {
    const name = row.querySelector('.data-mix-name')!.textContent!.trim();
    const pct = row.querySelector('.data-mix-pct')!.textContent!.trim();
    return `${name} ${pct}`;
  });
}

describe('data hero + template', () => {
  it('renders the eyebrow, h1, lede and the three shared explain cards', () => {
    // ARRANGE + ACT
    const m = mount();

    // ASSERT
    expect(
      within(m.root).getByRole('heading', { level: 1, name: 'How much reading does it take?' }),
    ).not.toBeNull();
    expect(within(m.root).getByText('01 · Core ideas')).toBeTruthy();
    expect(
      within(m.root).getByText(
        "Before a model can talk, it reads almost everything — and learns what's worth keeping.",
      ),
    ).toBeTruthy();
    expect(m.root.querySelectorAll('.explain-card')).toHaveLength(3);
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(m.root).getByText(title)).toBeTruthy();
    }
  });

  it('degrades to the .viz-fallback in jsdom, without a canvas', () => {
    const m = mount();
    expect(m.root.querySelector('.viz-fallback')).not.toBeNull();
    expect(m.root.querySelector('canvas')).toBeNull();
  });
});

describe('pipeline steps', () => {
  it('shows the full counter sequence, formatted with Intl.NumberFormat', () => {
    // ARRANGE + ACT
    const m = mount();

    // ASSERT — the fixed sequence 10,000,000 → 4,200,000 → 1,100,000 → 8,800,000
    const values = [...m.root.querySelectorAll('.data-counter .metric-value')].map(
      (el) => el.textContent!.trim(),
    );
    expect(values).toEqual([
      fmt.format(10_000_000),
      fmt.format(4_200_000),
      fmt.format(1_100_000),
      fmt.format(8_800_000),
    ]);
    // initially only the raw-intake counter is active
    const active = m.root.querySelectorAll('.data-counter--active');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain('10,000,000');
    expect(m.root.querySelector('.data-ring--active')).toBeNull();
    expect(m.root.querySelector('.data-status')?.textContent).toContain('Raw intake');
  });

  it('Next filter walks the four gated steps, updating counter + active ring, then disables', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const next = within(root).getByRole('button', { name: 'Next filter' }) as HTMLButtonElement;
    const expected: Array<{ ring: string; counter: string }> = [
      { ring: 'Curation', counter: '4,200,000' },
      { ring: 'Cleaning', counter: '1,100,000' },
      { ring: 'Deduplication', counter: '8,800,000' },
    ];

    // ACT + ASSERT — one press per filter; after the fourth state the
    // button is disabled
    for (const { ring, counter } of expected) {
      next.click();
      expect(root.querySelector('.data-status')?.textContent).toContain(ring);
      const activeRing = root.querySelector('.data-ring--active');
      expect(activeRing?.textContent).toContain(ring);
      const activeCounters = root.querySelectorAll('.data-counter--active');
      expect(activeCounters).toHaveLength(1);
      expect(activeCounters[0].textContent).toContain(counter);
    }
    expect(next.disabled).toBe(true);
  });

  it('"Start over" resets to the raw intake and re-enables Next filter', () => {
    // ARRANGE — advance two steps
    const m = mount();
    const root = m.root;
    const next = within(root).getByRole('button', { name: 'Next filter' }) as HTMLButtonElement;
    next.click();
    next.click();
    expect(root.querySelector('.data-ring--active')?.textContent).toContain('Cleaning');

    // ACT
    within(root).getByRole('button', { name: 'Start over' }).click();

    // ASSERT
    expect(next.disabled).toBe(false);
    const active = root.querySelector('.data-counter--active');
    expect(active?.textContent).toContain('10,000,000');
    expect(root.querySelector('.data-ring--active')).toBeNull();
    expect(root.querySelector('.data-ring--passed')).toBeNull();
    expect(root.querySelector('.data-status')?.textContent).toContain('Raw intake');
  });
});

describe('topic mix', () => {
  it('starts with all four topics on, at their base shares', () => {
    const m = mount();
    expect(mixRows(m.root)).toEqual([
      'Books 30%',
      'Code 20%',
      'Web pages 35%',
      'Chats 15%',
    ]);
    m.root.querySelectorAll('.data-topic-toggle').forEach((t) => {
      expect(t.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('turning off a topic re-weights the remaining shares', () => {
    const m = mount();
    const root = m.root;

    // ACT — switch Books off: the other three renormalise to a 70 base
    within(root).getByRole('switch', { name: 'Books' }).click();

    // ASSERT — Code 20/70, Web 35/70, Chats 15/70
    expect(mixRows(root)).toEqual([
      'Books 0%',
      'Code 29%',
      'Web pages 50%',
      'Chats 21%',
    ]);
    const fills = root.querySelectorAll<HTMLElement>('.data-mix-fill');
    expect(fills[0].style.width).toBe('0%');
    expect(fills[1].style.width).toBe('28.57%');
    expect(fills[2].style.width).toBe('50%');
    expect(fills[3].style.width).toBe('21.43%');
    expect(within(root).getByRole('switch', { name: 'Books' }).getAttribute('aria-checked')).toBe(
      'false',
    );

    // ACT + ASSERT — switching it back restores the base share
    within(root).getByRole('switch', { name: 'Books' }).click();
    expect(mixRows(root)[0]).toBe('Books 30%');
    expect(root.querySelectorAll<HTMLElement>('.data-mix-fill')[0].style.width).toBe('30%');
  });

  it('code-only fills the bar 100%, none leaves it empty', () => {
    const m = mount();
    const root = m.root;

    // ACT — leave only Code on
    for (const name of ['Books', 'Web pages', 'Chats'] as const) {
      within(root).getByRole('switch', { name }).click();
    }

    // ASSERT — the code-only mix
    expect(mixRows(root)).toEqual([
      'Books 0%',
      'Code 100%',
      'Web pages 0%',
      'Chats 0%',
    ]);
    const fills = root.querySelectorAll<HTMLElement>('.data-mix-fill');
    expect(fills[1].style.width).toBe('100%');
    expect(fills[0].style.width).toBe('0%');
    expect(fills[2].style.width).toBe('0%');
    expect(fills[3].style.width).toBe('0%');

    // ACT + ASSERT — switch Code off too: the mix is empty
    within(root).getByRole('switch', { name: 'Code' }).click();
    expect(mixRows(root)).toEqual([
      'Books 0%',
      'Code 0%',
      'Web pages 0%',
      'Chats 0%',
    ]);
    root.querySelectorAll<HTMLElement>('.data-mix-fill').forEach((f) => expect(f.style.width).toBe('0%'));
  });
});

describe('window listener hygiene', () => {
  it('removes its window resize listener on unmount (no leak on the no-WebGL path)', () => {
    // ARRANGE — spy on registration instead of dispatching events. In
    // jsdom every data-page mount takes the no-WebGL fallback path, which
    // used to leak its resize listener on unmount. The 3D helper adds no
    // resize listener on that path, so only the section's own
    // registration/removal is counted.
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    // ACT — three mount/unmount cycles.
    for (let i = 0; i < 3; i += 1) {
      const m = mountPage(page);
      m.unmount();
    }
    const adds = addSpy.mock.calls.filter((args) => args[0] === 'resize').length;
    const removes = removeSpy.mock.calls.filter((args) => args[0] === 'resize').length;
    addSpy.mockRestore();
    removeSpy.mockRestore();

    // ASSERT — balanced: one removal for every registration (3/3).
    expect(adds).toBe(3);
    expect(removes).toBe(3);
  });
});
