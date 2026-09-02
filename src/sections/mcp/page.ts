import type { Page } from '../../router';
import { mountMcpExplain, mountMcpViz } from './viz';
import './mcp.css';

/**
 * MCP servers — "09 · Going agentic". A DOM/CSS/SVG-only stage (no 3D,
 * per the Task 11 spec): apps plug their favourite servers into one
 * universal USB-C-shaped socket, and each docked server shows up as a
 * "connected" chip plus a drawn cable. The shell adds the hero and
 * pager.
 */
export const page: Page = {
  title: 'The USB-C of AI',
  eyebrow: '09 · Going agentic',
  lede: 'One standard socket means any tool fits any model — no custom wiring.',
  mount(root) {
    const cleanups = [mountMcpViz(root), mountMcpExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
