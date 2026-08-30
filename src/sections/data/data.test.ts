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

const fmt = (n: number): string => new Intl.NumberFormat('en-US').format(n);

/** Counter values in chain order, e.g. `['10,000,000', '—', '—', '—']`. */
function counterValues(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.data-counter .metric-value')].map(
    (el) => el.textContent!.trim(),
  );
}

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

describe('the filter console', () => {
  it('starts on stage 1 with its question, three options and the counter chain', () => {
    // ARRANGE + ACT
    const m = mount();
    const root = m.root;

    // ASSERT — stage-1 question + its three options
    expect(within(root).getByText('Ten million pages arrived. Which sources does the model get to read?')).toBeTruthy();
    for (const label of ['Keep it broad', 'Best sources only', 'Books & scholarly articles']) {
      const btn = within(root).getByRole('button', { name: new RegExp(`^${label}`) });
      expect(btn.classList.contains('data-option')).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
    // ASSERT — raw intake shown, the other three counters still `—`
    expect(counterValues(root)).toEqual([
      fmt(10_000_000),
      '—',
      '—',
      '—',
    ]);
    expect(within(root).getByText('tokens ready')).toBeTruthy();
    // ASSERT — the verdict is not shown yet, Back is hidden
    expect(root.querySelector<HTMLElement>('.data-verdict')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('.data-back')?.hidden).toBe(true);
  });

  it('picking "Best sources only" fills counter 2 and advances to stage 2', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    within(root).getByRole('button', { name: /^Best sources only/ }).click();

    // ASSERT — 4,200,000 clean pages, stage-2 question, Back now visible
    expect(counterValues(root)).toEqual([
      fmt(10_000_000),
      fmt(4_200_000),
      '—',
      '—',
    ]);
    expect(within(root).getByText('The pages are in. How hard do we scrub the junk out of them?')).toBeTruthy();
    expect(root.querySelector<HTMLElement>('.data-back')?.hidden).toBe(false);
  });

  it('full run [1,1,1] → 1,039,500 unique pages, 8,316,000 tokens, quality 60%', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — Best sources only / Standard scrub / Standard dedup
    within(root).getByRole('button', { name: /^Best sources only/ }).click();
    within(root).getByRole('button', { name: /^Standard scrub/ }).click();
    within(root).getByRole('button', { name: /^Standard dedup/ }).click();

    // ASSERT — final counters (unique pages = the dedup result)
    expect(counterValues(root)).toEqual([
      fmt(10_000_000),
      fmt(4_200_000),
      fmt(1_039_500),
      fmt(8_316_000),
    ]);
    // ASSERT — quality meter + verdict line 3
    const quality = root.querySelector('.data-quality')!;
    expect(quality.getAttribute('role')).toBe('progressbar');
    expect(quality.getAttribute('aria-valuenow')).toBe('60');
    expect(within(root).getByText('Data quality 60%')).toBeTruthy();
    expect(within(root).getByText('Careful data — you would be proud of the reading list.')).toBeTruthy();
    // ASSERT — all three rings have passed
    expect(root.querySelectorAll('.data-ring--passed')).toHaveLength(3);
    expect(root.querySelector('.data-ring--active')).toBeNull();
  });

  it('full run [2,2,2] → 240,000 unique pages, 1,920,000 tokens, quality 90%', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — Books & scholarly articles / Surgical / Aggressive dedup
    within(root).getByRole('button', { name: /^Books & scholarly articles/ }).click();
    within(root).getByRole('button', { name: /^Surgical/ }).click();
    within(root).getByRole('button', { name: /^Aggressive dedup/ }).click();

    // ASSERT — 240,000 unique pages (the dedup result), 1,920,000 tokens
    expect(counterValues(root)).toEqual([
      fmt(10_000_000),
      fmt(2_000_000),
      fmt(240_000),
      fmt(1_920_000),
    ]);
    expect(root.querySelector('.data-quality')?.getAttribute('aria-valuenow')).toBe('90');
    expect(within(root).getByText('Data quality 90%')).toBeTruthy();
    expect(
      within(root).getByText(
        'The rarest recipe of all: a tiny, perfect diet. Quality over quantity.',
      ),
    ).toBeTruthy();
  });

  it('Back returns to a stage with its choice pre-pressed; changing it recomputes downstream', () => {
    // ARRANGE — complete the run with option 2 on every stage
    const m = mount();
    const root = m.root;
    within(root).getByRole('button', { name: /^Books & scholarly articles/ }).click();
    within(root).getByRole('button', { name: /^Surgical/ }).click();
    within(root).getByRole('button', { name: /^Aggressive dedup/ }).click();
    expect(counterValues(root)[1]).toBe(fmt(2_000_000));

    // ACT — back through dedup, cleaning, to stage 1 (each pre-pressed)
    within(root).getByRole('button', { name: '← Back' }).click();
    expect(within(root).getByRole('button', { name: /^Aggressive dedup/ })
      .getAttribute('aria-pressed')).toBe('true');
    within(root).getByRole('button', { name: '← Back' }).click();
    expect(within(root).getByRole('button', { name: /^Surgical/ })
      .getAttribute('aria-pressed')).toBe('true');
    within(root).getByRole('button', { name: '← Back' }).click();
    expect(within(root).getByRole('button', { name: /^Books & scholarly articles/ })
      .getAttribute('aria-pressed')).toBe('true');

    // ACT — switch stage 1 to option 0 ("Keep it broad")
    within(root).getByRole('button', { name: /^Keep it broad/ }).click();

    // ASSERT — stage-1 result recomputed and everything downstream
    // recomputes live (later choices intact): 8,500,000 × 0.4 × 0.3
    expect(counterValues(root)).toEqual([
      fmt(10_000_000),
      fmt(8_500_000),
      fmt(1_020_000),
      fmt(8_160_000),
    ]);
    // finish the run again: re-select Surgical + Aggressive dedup
    within(root).getByRole('button', { name: /^Surgical/ }).click();
    within(root).getByRole('button', { name: /^Aggressive dedup/ }).click();
    expect(counterValues(root)).toEqual([
      fmt(10_000_000),
      fmt(8_500_000),
      fmt(1_020_000),
      fmt(8_160_000),
    ]);
    expect(within(root).getByText('Data quality 70%')).toBeTruthy();
  });

  it('"Start over" resets to the raw intake', () => {
    // ARRANGE — advance two stages
    const m = mount();
    const root = m.root;
    within(root).getByRole('button', { name: /^Best sources only/ }).click();
    within(root).getByRole('button', { name: /^Standard scrub/ }).click();
    expect(counterValues(root)).toEqual([fmt(10_000_000), fmt(4_200_000), '—', '—']);

    // ACT
    within(root).getByRole('button', { name: 'Start over' }).click();

    // ASSERT — everything back to the initial state
    expect(counterValues(root)).toEqual([fmt(10_000_000), '—', '—', '—']);
    expect(within(root).getByText('Ten million pages arrived. Which sources does the model get to read?')).toBeTruthy();
    expect(root.querySelector<HTMLElement>('.data-back')?.hidden).toBe(true);
    expect(root.querySelector('.data-ring--active')?.textContent).toContain('Curation');
    expect(root.querySelectorAll('.data-ring--passed')).toHaveLength(0);
    expect(root.querySelector<HTMLElement>('.data-verdict')?.hidden).toBe(true);
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
    root
      .querySelectorAll<HTMLElement>('.data-mix-fill')
      .forEach((f) => expect(f.style.width).toBe('0%'));
  });
});

describe('window listener hygiene', () => {
  it('removes its window resize listener on unmount (no leak on the no-WebGL path)', () => {
    // ARRANGE — the kit registers exactly one window resize listener per
    // mount (removed again on dispose); the section adds none of its own.
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
