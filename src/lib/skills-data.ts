// Skill definitions for the Skills page visualization.
// Each skill represents a reusable knowledge package that teaches an agent
// domain-specific expertise.

export type SkillCategory = 'coding' | 'data-analysis' | 'research' | 'creative' | 'devops' | 'communication';

export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  details: string;
  icon: string; // SVG path data
  tags: string[];
}

export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; icon: string }> = {
  coding: { label: 'Coding', icon: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18v3a2 2 0 01-2 2h-3m-8 0h3a2 2 0 002-2v-3M3 7l9 9 9-9' },
  'data-analysis': { label: 'Data Analysis', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m8-12a2 2 0 00-2-2h-2a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2V7z' },
  research: { label: 'Research', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  creative: { label: 'Creative', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.707.707m0-2.828a5 5 0 117.072 0l.707-.707' },
  devops: { label: 'DevOps', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  communication: { label: 'Communication', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
};

export const SKILLS: SkillDefinition[] = [
  // ── Coding ───────────────────────────────────────────────────────
  {
    id: 'debugging',
    name: 'Debugging',
    category: 'coding',
    description: 'Systematically trace and fix bugs using stack traces, log analysis, and breakpoint reasoning.',
    details: 'Teaches the agent to read error messages, trace execution paths, isolate faulty code regions, and suggest targeted fixes. Includes pattern recognition for common bugs like off-by-one errors, null references, and race conditions.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    tags: ['debug', 'errors', 'tracing'],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    category: 'coding',
    description: 'Analyze code for quality, security, performance, and style with actionable feedback.',
    details: 'Trains the agent to evaluate code against best practices: checking for security vulnerabilities, performance anti-patterns, readability issues, and adherence to style guides. Provides structured review comments with severity ratings.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    tags: ['review', 'quality', 'security'],
  },
  {
    id: 'refactoring',
    name: 'Refactoring',
    category: 'coding',
    description: 'Restructure code to improve clarity and maintainability without changing behavior.',
    details: 'Teaches safe transformation patterns: extract method, rename variables, simplify conditionals, remove duplication, and apply design patterns. Emphasizes preserving existing tests while improving code structure.',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m8.424 7a3 3 0 10-6 0 3 3 0 006 0z',
    tags: ['refactor', 'clean-code', 'maintainability'],
  },
  {
    id: 'testing',
    name: 'Test Generation',
    category: 'coding',
    description: 'Write comprehensive unit, integration, and end-to-end tests from code or specifications.',
    details: 'Trains the agent to generate test suites covering happy paths, edge cases, and error conditions. Supports multiple frameworks (Jest, pytest, JUnit) and patterns like property-based testing and mutation testing.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    tags: ['tests', 'coverage', 'assertions'],
  },

  // ── Data Analysis ────────────────────────────────────────────────
  {
    id: 'statistics',
    name: 'Statistical Analysis',
    category: 'data-analysis',
    description: 'Apply statistical methods: hypothesis testing, regression, distributions, and significance.',
    details: 'Enables the agent to choose appropriate statistical tests, interpret p-values and confidence intervals, build regression models, and communicate findings in plain language. Covers both parametric and non-parametric methods.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m8-12a2 2 0 00-2-2h-2a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2V7z',
    tags: ['statistics', 'hypothesis', 'regression'],
  },
  {
    id: 'data-visualization',
    name: 'Data Visualization',
    category: 'data-analysis',
    description: 'Create effective charts and graphs that reveal patterns and tell data stories.',
    details: 'Trains the agent to select appropriate chart types for different data relationships, apply visual encoding best practices, and generate production-ready charts using libraries like D3, matplotlib, or ggplot.',
    icon: 'M7 12l3-3 3 3 4-4M8 21H4a1 1 0 01-1-1V8l3-3 4 4h11a1 1 0 011 1v10a1 1 0 01-1 1h-4',
    tags: ['charts', 'graphs', 'storytelling'],
  },
  {
    id: 'data-cleaning',
    name: 'Data Cleaning',
    category: 'data-analysis',
    description: 'Detect and fix data quality issues: missing values, outliers, duplicates, and inconsistencies.',
    details: 'Teaches systematic data profiling, imputation strategies, outlier detection methods, deduplication techniques, and type normalization. Helps agents prepare raw data for reliable analysis.',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2v0a2 2 0 00-2 2v0M5 11V9a2 2 0 002-2v0a2 2 0 002 2v0m0 0a2 2 0 012 2v0a2 2 0 012-2v0',
    tags: ['cleaning', 'profiling', 'imputation'],
  },

  // ── Research ─────────────────────────────────────────────────────
  {
    id: 'web-search',
    name: 'Web Search',
    category: 'research',
    description: 'Formulate effective search queries and synthesize results from multiple sources.',
    details: 'Trains the agent to craft precise search queries using advanced operators, evaluate source credibility, cross-reference findings across multiple results, and synthesize a coherent summary from diverse sources.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    tags: ['search', 'queries', 'synthesis'],
  },
  {
    id: 'literature-review',
    name: 'Literature Review',
    category: 'research',
    description: 'Survey academic papers and technical documentation to build comprehensive knowledge.',
    details: 'Teaches the agent to search academic databases, extract key findings from papers, identify research gaps, map citation networks, and produce structured literature reviews with thematic organization.',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C21.168 18.477 19.582 18 17.834 18c-1.746 0-3.332.477-4.5 1.253',
    tags: ['papers', 'academic', 'review'],
  },
  {
    id: 'fact-checking',
    name: 'Fact Checking',
    category: 'research',
    description: 'Verify claims against authoritative sources and assess confidence in statements.',
    details: 'Trains the agent to identify verifiable claims, locate authoritative sources, compare conflicting information, and assign confidence scores. Includes detection of common misinformation patterns.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    tags: ['verification', 'accuracy', 'sources'],
  },

  // ── Creative ─────────────────────────────────────────────────────
  {
    id: 'technical-writing',
    name: 'Technical Writing',
    category: 'creative',
    description: 'Compose clear documentation, API guides, and technical explanations.',
    details: 'Teaches the agent to structure technical documents with logical flow, use precise terminology, include code examples, and adapt tone for different audiences — from developer docs to executive summaries.',
    icon: 'M11 5H6a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-5m-2 4h-2m-2-4h-2v4m-2-4h-2v4',
    tags: ['docs', 'documentation', 'clarity'],
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming',
    category: 'creative',
    description: 'Generate diverse ideas through structured creative techniques and lateral thinking.',
    details: 'Trains the agent to apply creative frameworks: SCAMPER, mind mapping, reverse brainstorming, and random stimulus. Encourages quantity before quality, defers judgment, and builds on others ideas.',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.707.707m0-2.828a5 5 0 117.072 0l.707-.707',
    tags: ['ideas', 'creativity', 'innovation'],
  },
  {
    id: 'content-generation',
    name: 'Content Generation',
    category: 'creative',
    description: 'Produce engaging content: blog posts, social media, marketing copy, and newsletters.',
    details: 'Teaches the agent to match tone and style to target audiences, structure content for engagement, optimize for SEO, maintain brand voice consistency, and generate content at various lengths.',
    icon: 'M11 5H6a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-5m-2 4l-2-2m2 2l10-10',
    tags: ['content', 'copy', 'marketing'],
  },

  // ── DevOps ───────────────────────────────────────────────────────
  {
    id: 'deployment',
    name: 'Deployment',
    category: 'devops',
    description: 'Orchestrate application deployments across cloud platforms and container environments.',
    details: 'Trains the agent to generate deployment configs for Kubernetes, Docker, and major cloud providers. Covers blue-green deployments, canary releases, rollback strategies, and environment promotion workflows.',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    tags: ['deploy', 'kubernetes', 'containers'],
  },
  {
    id: 'monitoring',
    name: 'Monitoring Setup',
    category: 'devops',
    description: 'Configure observability: metrics, logging, tracing, and alerting for production systems.',
    details: 'Teaches the agent to design monitoring dashboards, set meaningful alert thresholds, configure log aggregation, implement distributed tracing, and establish SLOs/SLIs for service reliability.',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
    tags: ['observability', 'alerts', 'metrics'],
  },
  {
    id: 'cicd',
    name: 'CI/CD Pipeline',
    category: 'devops',
    description: 'Design and maintain continuous integration and delivery pipelines for automated builds.',
    details: 'Trains the agent to author pipeline configs for GitHub Actions, GitLab CI, and Jenkins. Covers build optimization, test orchestration, artifact management, and automated release workflows.',
    icon: 'M19 14l-7 7m0 0l-7-7m7 7V3',
    tags: ['pipeline', 'automation', 'release'],
  },

  // ── Communication ────────────────────────────────────────────────
  {
    id: 'summarization',
    name: 'Summarization',
    category: 'communication',
    description: 'Condense long documents, meetings, and conversations into concise, accurate summaries.',
    details: 'Teaches the agent to identify key points, preserve critical information, maintain factual accuracy, and adapt summary length to audience needs. Supports both extractive and abstractive summarization.',
    icon: 'M4 6h16M4 12h16M4 18h16',
    tags: ['summary', 'condense', 'key-points'],
  },
  {
    id: 'translation',
    name: 'Translation',
    category: 'communication',
    description: 'Translate text between languages while preserving meaning, tone, and cultural context.',
    details: 'Trains the agent to handle translation across 50+ language pairs, maintain domain-specific terminology, adapt idioms and cultural references, and preserve the original tone and register.',
    icon: 'M3 5h12M9 3v2m1.028 2.665L7.665 12l2.364 2.335L12.665 12l-2.364-2.335L12.028 7.665M21 5H9',
    tags: ['language', 'i18n', 'localization'],
  },
  {
    id: 'email-drafting',
    name: 'Email Drafting',
    category: 'communication',
    description: 'Compose professional emails: requests, updates, follow-ups, and formal correspondence.',
    details: 'Teaches the agent to match email tone to context (formal, casual, urgent), structure messages with clear subject lines and calls to action, handle sensitive topics diplomatically, and maintain professional etiquette.',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    tags: ['email', 'professional', 'correspondence'],
  },
];

export function getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return SKILLS.filter(s => s.category === category);
}

export function searchSkills(query: string): SkillDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return SKILLS;
  return SKILLS.filter(
    s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
  );
}

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILLS.find(s => s.id === id);
}

export function getAllCategories(): SkillCategory[] {
  return Object.keys(SKILL_CATEGORIES) as SkillCategory[];
}
