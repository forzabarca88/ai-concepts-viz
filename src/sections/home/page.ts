import type { Page } from '../../router';
import { mountExplainCards, mountNextToken, mountOverviewMap } from './viz';
import './home.css';

/**
 * Home — "00 · Start here". The reference section: `.stage` demo first,
 * supporting content second, the shared explain-grid third (the shell
 * adds the `.pager` after `.page-content`).
 */
export const page: Page = {
  title: 'How machines learn to talk',
  eyebrow: '00 · Start here',
  lede: 'A friendly, hands-on tour of large language models. No math required — just curiosity.',
  mount(root) {
    const cleanups = [mountNextToken(root), mountOverviewMap(root), mountExplainCards(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
