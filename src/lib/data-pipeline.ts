export interface PipelineNode {
  id: string;
  label: string;
  stat: string;
  statValue: string;
  description: string;
  color: string;
}

export interface PipelineLink {
  source: string;
  target: string;
  value: number;
  label: string;
}

export const pipelineNodes: PipelineNode[] = [
  {
    id: 'raw',
    label: 'Raw Data',
    stat: 'Total tokens',
    statValue: '560B',
    description:
      'Unfiltered text scraped from the internet — web pages, forums, code repositories, books, and academic papers. Sources include Common Crawl, Wikipedia, GitHub, and licensed corpora.',
    color: '#5E5CE6',
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    stat: 'After cleaning',
    statValue: '500B',
    description:
      'Remove boilerplate (nav bars, ads, footers), fix encoding issues, strip HTML tags, and eliminate garbled or binary content. About 11% of raw data is discarded.',
    color: '#7B79D6',
  },
  {
    id: 'filtering',
    label: 'Filtering',
    stat: 'After filtering',
    statValue: '350B',
    description:
      'Apply quality classifiers to rank documents by readability, factual density, and language. Drop spam, low-quality auto-generated content, and toxic text. Retains the best ~70%.',
    color: '#9896C6',
  },
  {
    id: 'formatting',
    label: 'Formatting',
    stat: 'After formatting',
    statValue: '300B',
    description:
      'Normalize whitespace, standardize line endings, apply consistent document structure, and split into training sequences. Some documents are merged or split for optimal context length.',
    color: '#B5B3B6',
  },
  {
    id: 'training',
    label: 'Training Set',
    stat: 'Final corpus',
    statValue: '200B',
    description:
      'The curated dataset ready for model training. Balanced across domains: ~30% code, ~25% academic, ~20% web text, ~15% books, ~10% other. This is what the model actually learns from.',
    color: '#D2D0D3',
  },
];

export const pipelineLinks: PipelineLink[] = [
  { source: 'raw', target: 'cleaning', value: 500, label: 'Passes cleaning' },
  { source: 'cleaning', target: 'filtering', value: 350, label: 'Passes quality filter' },
  { source: 'filtering', target: 'formatting', value: 300, label: 'Formatted' },
  { source: 'formatting', target: 'training', value: 200, label: 'Ready for training' },
];

export const droppedLinks: PipelineLink[] = [
  { source: 'raw', target: 'dropped', value: 60, label: 'Boilerplate & noise' },
  { source: 'cleaning', target: 'dropped', value: 150, label: 'Low-quality content' },
  { source: 'filtering', target: 'dropped', value: 50, label: 'Failed quality checks' },
  { source: 'formatting', target: 'dropped', value: 100, label: 'Excess & duplicates' },
];

export const dataSources = [
  {
    name: 'Common Crawl',
    description: 'Web crawl of publicly accessible websites — the largest single source of training text.',
    share: '40%',
  },
  {
    name: 'Wikipedia',
    description: 'Multilingual encyclopedic content across 300+ language editions.',
    share: '10%',
  },
  {
    name: 'GitHub',
    description: 'Public code repositories providing programming language training data.',
    share: '20%',
  },
  {
    name: 'Books & Papers',
    description: 'Licensed books (e.g., OpenWebText) and academic preprints from arXiv.',
    share: '15%',
  },
  {
    name: 'Forums & Q&A',
    description: 'Stack Exchange, Reddit, and discussion forums for conversational patterns.',
    share: '10%',
  },
  {
    name: 'Other',
    description: 'Government documents, news archives, and domain-specific corpora.',
    share: '5%',
  },
];
