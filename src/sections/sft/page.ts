import type { Page } from '../../router';
import { mountSftExplain, mountSftViz } from './viz';
import './sft.css';

/**
 * Supervised fine-tuning — "05 · How it's trained". A DOM/CSS-only
 * stage (no 3D, per the Task 7 spec): two chat panels (Base | Instruct)
 * answering the same prompt, a training-data strip with a quality bar,
 * and a revealed instruction/response pair (the shell adds the hero
 * and pager).
 */
export const page: Page = {
  title: 'From word-guessing to helping',
  eyebrow: "05 · How it's trained",
  lede: 'A little coaching turns a prediction machine into an assistant.',
  mount(root) {
    const cleanups = [mountSftViz(root), mountSftExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
