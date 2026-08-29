import type { Page } from '../../router';
import { mountToolExplain, mountToolViz } from './viz';
import './tool-calling.css';

/**
 * Tool calling — "07 · Going agentic". A clean SVG flow (no 3D, per the
 * Task 9 spec): user bubble → model bubble → tool card (hidden until
 * tools are on) → answer bubble, with the four beats Think → Call tool
 * → Read result → Answer (the shell adds the hero and pager).
 */
export const page: Page = {
  title: 'Teaching it to use a calculator',
  eyebrow: '07 · Going agentic',
  lede: "A model can't check the weather. But it can ask a tool to.",
  mount(root) {
    const cleanups = [mountToolViz(root), mountToolExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
