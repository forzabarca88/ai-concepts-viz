import type { Page } from '../../router';
import { mountExplainCards, mountKnobCloud } from './viz';
import './parameters.css';

/**
 * Parameters — "03 · Core ideas". A seeded 3D "knob cloud": a 2,000-dot
 * sphere the model learns over ten train steps, with a DOM knob-count
 * metric, knowledge meter, size slider and the shared explain grid (the
 * shell adds the hero and pager).
 */
export const page: Page = {
  title: 'Billions of tiny knobs',
  eyebrow: '03 · Core ideas',
  lede: "Everything a model 'knows' lives in billions of numbers, nudged a little at a time.",
  mount(root) {
    const cleanups = [mountKnobCloud(root), mountExplainCards(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
