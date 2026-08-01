// Tool call flow data and state machine for interactive visualization.
// Models the 5-step cycle: user prompt → agent thinks → tool call → tool result → agent response.

// ── Types ──────────────────────────────────────────────────────────

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // SVG path data
  parameters: { name: string; type: string; description: string }[];
  exampleArgs: Record<string, string | number>;
  exampleResult: string;
}

export interface FlowStep {
  id: string;
  label: string;
  description: string;
  detail: string;
  icon: string; // emoji or short symbol for the step indicator
}

export interface ToolCallFlowState {
  currentStepIndex: number;
  selectedToolId: string;
  isAnimating: boolean;
}

// ── Flow Steps ─────────────────────────────────────────────────────

export const FLOW_STEPS: FlowStep[] = [
  {
    id: 'user-prompt',
    label: 'User Prompt',
    description: 'You send a message to the agent.',
    detail: 'The user types a request that may require external information or action.',
    icon: '💬',
  },
  {
    id: 'agent-thinks',
    label: 'Agent Thinks',
    description: 'The model decides a tool is needed.',
    detail: 'The LLM analyzes the request and determines it cannot answer from training data alone — it needs to call a tool.',
    icon: '🧠',
  },
  {
    id: 'tool-call',
    label: 'Tool Call',
    description: 'The model generates structured tool arguments.',
    detail: 'The LLM outputs a structured JSON object specifying which tool to invoke and with what parameters.',
    icon: '🔧',
  },
  {
    id: 'tool-result',
    label: 'Tool Result',
    description: 'The tool executes and returns data.',
    detail: 'The runtime executes the tool (e.g., a web search, API call) and feeds the result back into the model.',
    icon: '📦',
  },
  {
    id: 'agent-response',
    label: 'Agent Response',
    description: 'The model composes a final answer.',
    detail: 'Now equipped with real-world data, the LLM generates a helpful, grounded response for the user.',
    icon: '✨',
  },
];

// ── Tool Definitions ───────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'search',
    name: 'Web Search',
    description: 'Search the internet for current information.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    parameters: [
      { name: 'query', type: 'string', description: 'The search query text' },
    ],
    exampleArgs: { query: 'latest AI breakthroughs 2025' },
    exampleResult: `[1] "Major advances in reasoning models — Nature, Jan 2025"\n[2] "Open-source LLMs reach new benchmarks — arXiv"\n[3] "AI safety frameworks updated — OECD, Dec 2024"`,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform precise mathematical calculations.',
    icon: 'M9 7h6m0 0a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110 4 2 2 0 010-4zm-6 4a2 2 0 110-4 2 2 0 010 4zm12 0a2 2 0 110-4 2 2 0 010 4z',
    parameters: [
      { name: 'expression', type: 'string', description: 'Math expression to evaluate' },
    ],
    exampleArgs: { expression: '47.3 * 12.8 + sqrt(144)' },
    exampleResult: '622.44',
  },
  {
    id: 'weather',
    name: 'Weather Lookup',
    description: 'Get current weather for a location.',
    icon: 'M3 15a4 4 0 011-7l8-5a4 4 0 015 0l8 5a4 4 0 01-1 7H3z',
    parameters: [
      { name: 'location', type: 'string', description: 'City or coordinates' },
      { name: 'unit', type: 'string', description: 'Temperature unit (celsius/fahrenheit)' },
    ],
    exampleArgs: { location: 'Tokyo', unit: 'celsius' },
    exampleResult: `{ "location": "Tokyo, JP", "temperature": 18, "humidity": 65, "condition": "Partly Cloudy", "wind": "12 km/h NW" }`,
  },
];

// ── State Machine ──────────────────────────────────────────────────

export function createToolCallFlowState(): ToolCallFlowState {
  return {
    currentStepIndex: 0,
    selectedToolId: 'search',
    isAnimating: false,
  };
}

export function advanceStep(state: ToolCallFlowState): void {
  if (state.currentStepIndex < FLOW_STEPS.length - 1) {
    state.currentStepIndex++;
  }
}

export function retreatStep(state: ToolCallFlowState): void {
  if (state.currentStepIndex > 0) {
    state.currentStepIndex--;
  }
}

export function resetFlow(state: ToolCallFlowState): void {
  state.currentStepIndex = 0;
}

export function selectTool(state: ToolCallFlowState, toolId: string): void {
  state.selectedToolId = toolId;
  state.currentStepIndex = 0;
}

export function getSelectedTool(toolId: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find(t => t.id === toolId);
}

export function getCurrentStep(state: ToolCallFlowState): FlowStep {
  return FLOW_STEPS[state.currentStepIndex];
}

export function isStepActive(state: ToolCallFlowState, stepId: string): boolean {
  return FLOW_STEPS[state.currentStepIndex]?.id === stepId;
}

export function isStepCompleted(state: ToolCallFlowState, stepId: string): boolean {
  const currentStep = FLOW_STEPS[state.currentStepIndex];
  const targetStep = FLOW_STEPS.find(s => s.id === stepId);
  return targetStep !== undefined && currentStep !== undefined
    && FLOW_STEPS.indexOf(currentStep) > FLOW_STEPS.indexOf(targetStep);
}

export function canAdvance(state: ToolCallFlowState): boolean {
  return state.currentStepIndex < FLOW_STEPS.length - 1;
}

export function canRetreat(state: ToolCallFlowState): boolean {
  return state.currentStepIndex > 0;
}
