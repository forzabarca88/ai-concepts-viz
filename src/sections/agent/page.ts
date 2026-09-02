import type { Page } from '../../router';
import { mountAgentExplain, mountAgentViz } from './viz';
import './agent.css';

/**
 * AI agent demo — "10 · Going agentic". The finale (no 3D, per the
 * Task 12 spec): a fixed goal, a Think → Act → Observe loop badge and
 * a timeline that fills as the agent runs — or gives up gracefully
 * (the shell adds the hero and pager).
 */
export const page: Page = {
  title: 'Think. Act. Observe. Repeat.',
  eyebrow: '10 · Going agentic',
  lede: 'Give it a goal and some tools — then watch the loop.',
  mount(root) {
    const cleanups = [mountAgentViz(root), mountAgentExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
