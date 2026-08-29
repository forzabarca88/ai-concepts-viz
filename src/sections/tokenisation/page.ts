import type { Page } from '../../router';
import { mountTokenExplain, mountTokenViz } from './viz';
import './tokenisation.css';

/**
 * Tokenisation — "02 · Core ideas". A DOM/CSS-only stage (no 3D, per the
 * Task 4 spec): the sentence as token chips, plus the token inspector,
 * grain view and next-token mini panels (the shell adds the hero and
 * pager).
 */
export const page: Page = {
  title: "Words aren't words — they're tokens",
  eyebrow: '02 · Core ideas',
  lede: "Models can't read letters. They read text in small chunks called tokens.",
  mount(root) {
    const cleanups = [mountTokenViz(root), mountTokenExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
