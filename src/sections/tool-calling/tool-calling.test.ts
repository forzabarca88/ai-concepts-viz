import { afterEach, describe, expect, it } from 'vitest';
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

const nodeIsActive = (root: HTMLElement, kind: 'model' | 'tool' | 'answer') =>
  root.querySelector<SVGElement>(`.tv-node--${kind}`)?.classList.contains('is-active') ?? false;

const toolsSwitch = (root: HTMLElement) =>
  within(root).getByRole('switch', { name: 'Tools: on/off' });

const stepBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Step through the call' }) as HTMLButtonElement;

const caption = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.tool-caption')?.textContent ?? '';

const toolsOn = (root: HTMLElement) => {
  toolsSwitch(root).click();
};

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
});

describe('tools on/off switch', () => {
  it('starts off: no tool card, the model admits it can\'t check', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector('.tv-node--tool')).toBeNull();
    expect(svgText(root, '.tv-answer-text')).toBe("I can't check that — I can't see the world!");
    expect(stepBtn(root).disabled).toBe(true);
  });

  it('on: the tool card appears with the fixed call and result', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    toolsOn(root);

    // ASSERT — the flow gains a hexagon tool card with fixed values
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('.tv-node--tool')).not.toBeNull();
    expect(svgText(root, '.tv-tool-call')).toBe('get_weather("Tokyo")');
    expect(svgText(root, '.tv-tool-result')).toBe('→ 21°C, sunny');
    expect(svgText(root, '.tv-answer-text')).toBe("It's 21°C and sunny in Tokyo.");
    expect(stepBtn(root).disabled).toBe(false);
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
    expect(stepBtn(root).disabled).toBe(true);
  });
});

describe('step through the call', () => {
  it('is disabled while tools are off', () => {
    // ARRANGE
    const m = mount();

    // ASSERT
    expect(stepBtn(m.root).disabled).toBe(true);
  });

  it('walks four captions in fixed order, highlighting the matching node', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = stepBtn(root);
    toolsOn(root);

    // ACT + ASSERT — beat 1: Think → model bubble
    btn.click();
    expect(caption(root)).toContain('Think —');
    expect(nodeIsActive(root, 'model')).toBe(true);
    expect(nodeIsActive(root, 'tool')).toBe(false);
    expect(nodeIsActive(root, 'answer')).toBe(false);

    // ACT + ASSERT — beat 2: Call tool → tool card
    btn.click();
    expect(caption(root)).toContain('Call tool —');
    expect(nodeIsActive(root, 'model')).toBe(false);
    expect(nodeIsActive(root, 'tool')).toBe(true);

    // ACT + ASSERT — beat 3: Read result → tool card, result line lit
    btn.click();
    expect(caption(root)).toContain('Read result —');
    expect(nodeIsActive(root, 'tool')).toBe(true);
    expect(
      root
        .querySelector<SVGElement>('.tv-tool-result')
        ?.classList.contains('tv-tool-result--active'),
    ).toBe(true);

    // ACT + ASSERT — beat 4: Answer → answer bubble, then disabled
    btn.click();
    expect(caption(root)).toContain('Answer —');
    expect(nodeIsActive(root, 'answer')).toBe(true);
    expect(btn.disabled).toBe(true);
  });

  it('stays at the final beat once the end is reached', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = stepBtn(root);
    toolsOn(root);
    btn.click();
    btn.click();
    btn.click();
    btn.click();
    expect(btn.disabled).toBe(true);

    // ACT — the locked button cannot advance any further
    btn.click();

    // ASSERT
    expect(caption(root)).toContain('Answer —');
    expect(btn.disabled).toBe(true);
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
    ['Time in Sydney', 'What time is it in Sydney?', 'get_time("Sydney")', '→ 3:40 pm', "It's 3:40 pm in Sydney."],
    ['13 × 7', 'What is 13 × 7?', 'calculator(13 × 7)', '→ 91', '13 × 7 is 91.'],
  ] as const)(
    '"%s" updates every value in the flow',
    (label, userLine, call, result, answer) => {
      // ARRANGE — tools on so the full flow is visible
      const m = mount();
      const root = m.root;
      toolsOn(root);
      const btn = within(root).getByRole('button', { name: label });

      // ACT
      btn.click();

      // ASSERT
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(svgText(root, '.tv-user-text')).toBe(userLine);
      expect(svgText(root, '.tv-tool-call')).toBe(call);
      expect(svgText(root, '.tv-tool-result')).toBe(result);
      expect(svgText(root, '.tv-answer-text')).toBe(answer);
    },
  );

  it('picking a new question restarts the steps', () => {
    // ARRANGE — walk to the end of the call
    const m = mount();
    const root = m.root;
    const btn = stepBtn(root);
    toolsOn(root);
    btn.click();
    btn.click();
    btn.click();
    btn.click();
    expect(btn.disabled).toBe(true);

    // ACT
    within(root).getByRole('button', { name: '13 × 7' }).click();

    // ASSERT — back to the ready state with the new question
    expect(btn.disabled).toBe(false);
    expect(svgText(root, '.tv-user-text')).toBe('What is 13 × 7?');
    expect(caption(root)).toBe('Four beats: Think → Call tool → Read result → Answer.');
  });
});
