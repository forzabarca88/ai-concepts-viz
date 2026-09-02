import type { Page } from '../../router';
import { mountSkillExplain, mountSkillViz } from './viz';
import './skills.css';

/**
 * Skills — "08 · Going agentic". A DOM/CSS/SVG-only stage (no 3D, per
 * the Task 10 spec): a friendly robot agent with a skill "backpack"
 * (teach/forget) and a three-task board whose readiness line is a pure
 * function of (learned skills, selected task). The shell adds the hero
 * and pager.
 */
export const page: Page = {
  title: 'Teaching it a job',
  eyebrow: '08 · Going agentic',
  lede: 'An agent is a model plus a set of skills it gets to practice.',
  mount(root) {
    const cleanups = [mountSkillViz(root), mountSkillExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
