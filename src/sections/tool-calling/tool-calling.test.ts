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

const svgText = (root: HTMLElement, selector: string) =>
  root.querySelector<SVGElement>(selector)?.textContent?.trim() ?? '';

const toolsSwitch = (root: HTMLElement) =>
  within(root).getByRole('switch', { name: 'Tools: on/off' });

const tryButton = (root: HTMLElement, label: string) =>
  within(root).getByRole('button', { name: label }) as HTMLButtonElement;

const tryButtons = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.tool-try'));

const toolsOn = (root: HTMLElement) => {
  toolsSwitch(root).click();
};

const caption = (root: HTMLElement) =>
  root.querySelector('.tool-caption')?.textContent ?? '';

const activeBeats = (root: HTMLElement) =>
  root.querySelectorAll('.tv-step--active').length;

const wrongTagInAnswer = (root: HTMLElement) =>
  root.querySelector<SVGElement>('.tv-wrong-tag')?.textContent ?? '';

const triedTag = (root: HTMLElement, label: string) =>
  tryButton(root, label).querySelector<HTMLElement>('.tool-try-tag');

describe('tool-calling page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).queryByRole('heading', {
        level: 1,
        name: 'Teaching it to use a calculator',
      }),
    ).not.toBeNull();
    expect(within(m.root).getByText('07 · Going agentic')).toBeTruthy();
    expect(
      within(m.root).getByText("A model can't check the weather. But it can ask a tool to."),
    ).toBeTruthy();
  });

  it('shows the three shared explain cards', () => {
    // ARRANGE
    const m = mount();

    // ASSERT
    expect(m.root.querySelector('.explain-grid')?.querySelectorAll('.explain-card')).toHaveLength(
      3,
    );
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(m.root).getByText(title)).toBeTruthy();
    }
  });

  it('degrades to the .viz-fallback in jsdom, without a canvas', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — the 3D packet-relay layer renders its fallback note in jsdom
    expect(m.root.querySelector('.viz-fallback')).not.toBeNull();
    expect(m.root.querySelector('canvas')).toBeNull();
  });
});

describe('initial state (tools off)', () => {
  it('no tool card, no "which tool" picker, the model admits it can\'t check', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector('.tv-node--tool')).toBeNull();
    expect(svgText(root, '.tv-answer-text')).toBe("I can't check that — I can't see the world!");
    expect((root.querySelector('.tool-choose') as HTMLElement).hidden).toBe(true);
    expect(tryButtons(root)).toHaveLength(3);
    expect(caption(root)).toBe('Tools off: the flow is just you → model → answer.');
    expect(activeBeats(root)).toBe(0);
  });
});

describe('tools switch', () => {
  it('on: the tool card appears and the "which tool" picker shows 3 tools', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    toolsOn(root);

    // ASSERT — the flow gains a hexagon tool card (pending) and the picker
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('.tv-node--tool')).not.toBeNull();
    expect(svgText(root, '.tv-tool-call')).toBe('?');
    expect(svgText(root, '.tv-tool-result')).toBe('→ ?');
    expect((root.querySelector('.tool-choose') as HTMLElement).hidden).toBe(false);
    const buttons = tryButtons(root);
    expect(buttons).toHaveLength(3);
    for (const btn of buttons) {
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
    expect(caption(root)).toBe('Four beats: Think → Call tool → Read result → Answer.');
    expect(activeBeats(root)).toBe(0);
  });

  it('off again: the tool card is hidden and the no-tools answer returns', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    toolsOn(root);
    expect(root.querySelector('.tv-node--tool')).not.toBeNull();

    // ACT
    toolsSwitch(root).click();

    // ASSERT
    expect(root.querySelector('.tv-node--tool')).toBeNull();
    expect(svgText(root, '.tv-answer-text')).toBe("I can't check that — I can't see the world!");
    expect((root.querySelector('.tool-choose') as HTMLElement).hidden).toBe(true);
  });
});

describe('tool choice (q0: weather in Tokyo)', () => {
  it('a wrong pick (calculator) shows the wrong call/result/answer and retires the tool', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    toolsOn(root);

    // ACT
    tryButton(root, 'calculator').click();

    // ASSERT — the wrong call and result, the fixed wrong answer (tagged)
    expect(svgText(root, '.tv-tool-call')).toBe('calculator("Tokyo")');
    expect(svgText(root, '.tv-tool-result')).toBe('→ Error: not a number');
    expect(svgText(root, '.tv-answer-text')).toBe('I got an error back. That is not a forecast.');
    expect(wrongTagInAnswer(root)).toBe('Wrong tool');
    expect(caption(root)).toBe('The model picked the wrong tool — it can try again.');
    expect(activeBeats(root)).toBe(3);

    // ASSERT — the tried tool is retired with its tag; the call is not finished
    const tried = tryButton(root, 'calculator');
    expect(tried.disabled).toBe(true);
    expect(triedTag(root, 'calculator')?.hidden).toBe(false);
    expect(triedTag(root, 'calculator')?.textContent).toBe('Tried — no help');
    expect(tryButton(root, 'get_weather').disabled).toBe(false);
    expect(tryButton(root, 'get_time').disabled).toBe(false);
  });

  it('the correct pick (get_weather) then runs all four beats in one click', () => {
    // ARRANGE — a wrong tool has already been tried
    const m = mount();
    const root = m.root;
    toolsOn(root);
    tryButton(root, 'calculator').click();

    // ACT
    tryButton(root, 'get_weather').click();

    // ASSERT — the tool card shows the correct call + result
    expect(svgText(root, '.tv-tool-call')).toBe('get_weather("Tokyo")');
    expect(svgText(root, '.tv-tool-result')).toBe('→ 21°C, sunny');

    // ASSERT — the answer is the real one (mint), all four beats lit
    expect(svgText(root, '.tv-answer-text')).toBe("It's 21°C and sunny in Tokyo.");
    expect(root.querySelector('.tv-wrong-tag')).toBeNull();
    expect(activeBeats(root)).toBe(4);
    expect(caption(root)).toBe(
      'Four beats, one click: Think → Call tool → Read result → Answer.',
    );

    // ASSERT — every tool button is disabled; the tried tool keeps its tag
    for (const btn of tryButtons(root)) expect(btn.disabled).toBe(true);
    expect(tryButton(root, 'get_weather').getAttribute('aria-pressed')).toBe('true');
    expect(triedTag(root, 'calculator')?.hidden).toBe(false);
    expect(triedTag(root, 'calculator')?.textContent).toBe('Tried — no help');
  });
});

describe('wrong picks (other questions)', () => {
  it.each([
    ['Weather in Tokyo', 'get_time', 'get_time("Tokyo")', '→ 9:00 am', 'It is 9:00 am in Tokyo.'],
    [
      'Time in Sydney',
      'get_weather',
      'get_weather("Sydney")',
      '→ 22°C, cloudy',
      'It is 22°C and cloudy in Sydney.',
    ],
    [
      'Time in Sydney',
      'calculator',
      'calculator("Sydney")',
      '→ Error: not a number',
      'The calculator sent back an error. No time there.',
    ],
    [
      '13 × 7',
      'get_weather',
      'get_weather("7")',
      '→ Error: unknown city',
      'I asked a weather service for a number. It was not helpful.',
    ],
    [
      '13 × 7',
      'get_time',
      'get_time("13 × 7")',
      '→ Error: bad input',
      'The clock does not multiply. That was my mistake.',
    ],
  ] as const)('%s → %s fails with its fixed wrong call/result/answer', (question, tool, call, result, answer) => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    toolsOn(root);
    if (question !== 'Weather in Tokyo') {
      within(root).getByRole('button', { name: question }).click();
    }

    // ACT
    tryButton(root, tool).click();

    // ASSERT
    expect(svgText(root, '.tv-tool-call')).toBe(call);
    expect(svgText(root, '.tv-tool-result')).toBe(result);
    expect(svgText(root, '.tv-answer-text')).toBe(answer);
    expect(wrongTagInAnswer(root)).toBe('Wrong tool');
    expect(tryButton(root, tool).disabled).toBe(true);
    expect(triedTag(root, tool)?.textContent).toBe('Tried — no help');
  });
});

describe('question picker', () => {
  it('defaults to "Weather in Tokyo"', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(
      within(root).getByRole('button', { name: 'Weather in Tokyo' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(svgText(root, '.tv-user-text')).toBe("What's the weather in Tokyo?");
  });

  it.each([
    ['Time in Sydney', 'What time is it in Sydney?'],
    ['13 × 7', 'What is 13 × 7?'],
  ] as const)('"%s" updates the user bubble', (label, userLine) => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = within(root).getByRole('button', { name: label });

    // ACT
    btn.click();

    // ASSERT
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(svgText(root, '.tv-user-text')).toBe(userLine);
  });

  it('switching questions resets the tried tools and the finished state', () => {
    // ARRANGE — run q0 to the end with one wrong try
    const m = mount();
    const root = m.root;
    toolsOn(root);
    tryButton(root, 'calculator').click();
    tryButton(root, 'get_weather').click();
    expect(activeBeats(root)).toBe(4);
    for (const btn of tryButtons(root)) expect(btn.disabled).toBe(true);

    // ACT
    within(root).getByRole('button', { name: '13 × 7' }).click();

    // ASSERT — back to the ready state with the new question
    expect(svgText(root, '.tv-user-text')).toBe('What is 13 × 7?');
    expect(svgText(root, '.tv-tool-call')).toBe('?');
    expect(caption(root)).toBe('Four beats: Think → Call tool → Read result → Answer.');
    expect(activeBeats(root)).toBe(0);
    for (const btn of tryButtons(root)) {
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
    expect(triedTag(root, 'calculator')?.hidden).toBe(true);
  });

  it('flipping tools resets the tried tools and the finished state', () => {
    // ARRANGE — a wrong try, then tools off
    const m = mount();
    const root = m.root;
    toolsOn(root);
    tryButton(root, 'calculator').click();
    toolsSwitch(root).click();
    expect(svgText(root, '.tv-answer-text')).toBe("I can't check that — I can't see the world!");

    // ACT
    toolsSwitch(root).click();

    // ASSERT — back to the pending state; every tool is tryable again
    expect(svgText(root, '.tv-tool-call')).toBe('?');
    expect(tryButton(root, 'calculator').disabled).toBe(false);
    expect(triedTag(root, 'calculator')?.hidden).toBe(true);
    expect(caption(root)).toBe('Four beats: Think → Call tool → Read result → Answer.');
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
