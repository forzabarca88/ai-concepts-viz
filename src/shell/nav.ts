/**
 * Site navigation data — single source of truth for the header nav and
 * the home overview map. The `number` is the curriculum order: the site
 * is a course, and order carries meaning. `home` is the brand link and
 * intentionally not numbered.
 */

export interface NavItem {
  /** Hash route (section folder name), rendered as `#/<route>`. */
  route: string;
  /** Curriculum number, e.g. "01". */
  number: string;
  title: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Core ideas',
    items: [
      { route: 'data', number: '01', title: 'Data to train an LLM' },
      { route: 'tokenisation', number: '02', title: 'Tokenisation' },
      { route: 'parameters', number: '03', title: 'Parameters & learning' },
    ],
  },
  {
    label: "How it's trained",
    items: [
      { route: 'pretraining', number: '04', title: 'Pre-training' },
      { route: 'sft', number: '05', title: 'Supervised fine-tuning' },
      { route: 'preferences', number: '06', title: 'Preference fine-tuning' },
    ],
  },
  {
    label: 'Going agentic',
    items: [
      { route: 'tool-calling', number: '07', title: 'Tool calling' },
      { route: 'skills', number: '08', title: 'Skills' },
      { route: 'mcp', number: '09', title: 'MCP servers' },
      { route: 'agent', number: '10', title: 'AI agent demo' },
    ],
  },
];

/** All ten numbered sections in curriculum order. */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
