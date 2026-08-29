import type { Page } from '../../router';
import { mountDataExplain, mountDataPipeline } from './viz';
import './data.css';

/**
 * Data — "01 · Core ideas". 3D "river of pages" streaming past three
 * filter rings, with DOM counters, a topic mix and the shared explain
 * grid (the shell adds the hero and pager).
 */
export const page: Page = {
  title: 'How much reading does it take?',
  eyebrow: '01 · Core ideas',
  lede: "Before a model can talk, it reads almost everything — and learns what's worth keeping.",
  mount(root) {
    const cleanups = [mountDataPipeline(root), mountDataExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
