// Demo scenario data for the Agent Simulator component.
// Each scenario simulates an autonomous agent solving a task step-by-step.
// Steps show the thinking process, tool calls, tool results, and final response.

// ── Types ──────────────────────────────────────────────────────────

export type StepType = 'thinking' | 'tool_call' | 'tool_result' | 'response';

export interface AgentStep {
  type: StepType;
  content: string;
  // For tool_call steps: the tool name and arguments
  toolName?: string;
  toolArgs?: Record<string, string | number>;
  // For tool_result steps: the output from the tool
  toolOutput?: string;
  // Display label for the step (e.g., "Thinking...", "Calling search_web", "Result", "Final Answer")
  label?: string;
  // Delay before this step appears (ms) — creates pacing in the simulation
  delay?: number;
}

export interface AgentScenario {
  id: string;
  title: string;
  description: string;
  // Short prompt the user "types" to trigger this scenario
  userPrompt: string;
  // Icon (emoji) for the scenario selector
  icon: string;
  steps: AgentStep[];
}

// ── Scenarios ──────────────────────────────────────────────────────

export const SCENARIOS: AgentScenario[] = [
  {
    id: 'plan-trip',
    title: 'Plan a Trip',
    description: 'Agent researches destinations, checks weather, and books a trip',
    icon: '✈️',
    userPrompt: 'Plan a weekend trip for me — I\'m in San Francisco and want somewhere scenic within 3 hours.',
    steps: [
      {
        type: 'thinking',
        content: 'The user wants a scenic weekend trip within 3 hours of San Francisco. I need to find destinations in that radius, then check their weather to make sure it\'s a good time to visit.',
        label: 'Thinking...',
        delay: 1200,
      },
      {
        type: 'tool_call',
        content: 'I\'ll search for scenic destinations near San Francisco within a 3-hour drive.',
        toolName: 'search_web',
        toolArgs: { query: 'scenic destinations within 3 hours of San Francisco' },
        label: '🔧 Calling search_web',
        delay: 800,
      },
      {
        type: 'tool_result',
        content: `[1] Napa Valley — 1h 15min drive, wine country, rolling hills
[2] Monterey/Carmel — 2h drive, coastal scenery, aquarium
[3] Lake Tahoe — 2h 45min drive, mountain lake, hiking trails
[4] Sonoma — 1h drive, similar to Napa but less crowded
[5] Big Sur — 2h 30min drive, dramatic coastal cliffs`,
        label: '📦 Tool result',
        toolOutput: `[1] Napa Valley — 1h 15min drive, wine country, rolling hills
[2] Monterey/Carmel — 2h drive, coastal scenery, aquarium
[3] Lake Tahoe — 2h 45min drive, mountain lake, hiking trails
[4] Sonoma — 1h drive, similar to Napa but less crowded
[5] Big Sur — 2h 30min drive, dramatic coastal cliffs`,
        delay: 1000,
      },
      {
        type: 'thinking',
        content: 'Good results. Top candidates: Napa Valley, Monterey, and Lake Tahoe. I should check the weather for each to recommend the best option for this weekend.',
        label: 'Thinking...',
        delay: 1000,
      },
      {
        type: 'tool_call',
        content: 'Checking weather forecasts for the top 3 destinations.',
        toolName: 'get_weather',
        toolArgs: { locations: 'Napa Valley, Monterey, Lake Tahoe', days: 'weekend' },
        label: '🔧 Calling get_weather',
        delay: 800,
      },
      {
        type: 'tool_result',
        content: `{
  "Napa Valley": { temp: 72, condition: "Sunny", humidity: 35 },
  "Monterey": { temp: 58, condition: "Foggy", humidity: 78 },
  "Lake Tahoe": { temp: 45, condition: "Partly Cloudy", humidity: 52 }
}`,
        label: '📦 Tool result',
        toolOutput: `{
  "Napa Valley": { temp: 72, condition: "Sunny", humidity: 35 },
  "Monterey": { temp: 58, condition: "Foggy", humidity: 78 },
  "Lake Tahoe": { temp: 45, condition: "Partly Cloudy", humidity: 52 }
}`,
        delay: 1000,
      },
      {
        type: 'thinking',
        content: 'Napa Valley has the best weather — sunny and 72°F. Monterey is foggy and cool, Lake Tahoe is chilly. Napa is also the closest at 1h 15min. This is a clear winner.',
        label: 'Thinking...',
        delay: 900,
      },
      {
        type: 'response',
        content: `I recommend **Napa Valley** for your weekend trip! Here's why:

**🌤️ Weather:** Sunny and 72°F — perfect for outdoor activities
**🚗 Distance:** Only 1h 15min drive from San Francisco
**🍷 Highlights:** World-class wineries, rolling vineyard scenery, and great restaurants

**Suggested itinerary:**
- **Saturday morning:** Visit a winery (e.g., Castello di Amorosa or Robert Mondavi)
- **Saturday afternoon:** Scenic drive through St. Helena and Calistoga
- **Saturday evening:** Dinner at a farm-to-table restaurant
- **Sunday:** Hot springs in Calistoga, then a leisurely lunch before heading home

Monterey would be foggy and chilly, and Lake Tahoe is quite cold this time of year — so Napa gives you the best experience with the weather on your side.

Want me to look up specific winery reservations or hotel options?`,
        label: '✨ Final Response',
        delay: 600,
      },
    ],
  },
  {
    id: 'debug-code',
    title: 'Debug Code',
    description: 'Agent diagnoses a bug, runs tests, and proposes a fix',
    icon: '🐛',
    userPrompt: 'My API endpoint returns a 500 error when I pass an empty array for "items". Help me fix it.',
    steps: [
      {
        type: 'thinking',
        content: 'A 500 error on an empty array input suggests the code isn\'t handling the edge case of an empty list. I need to read the endpoint code to find where it fails.',
        label: 'Thinking...',
        delay: 1200,
      },
      {
        type: 'tool_call',
        content: 'Let me read the source file for the API endpoint to find the bug.',
        toolName: 'read_file',
        toolArgs: { path: 'src/api/items.ts' },
        label: '🔧 Calling read_file',
        delay: 700,
      },
      {
        type: 'tool_result',
        content: `// src/api/items.ts
export async function processItems(items: string[]) {
  const total = items.reduce((sum, item) => sum + item.length, 0);
  const avg = total / items.length;  // ← divides by items.length
  const first = items[0].toUpperCase(); // ← accesses items[0]
  return { averageLength: avg, firstItem: first };
}`,
        label: '📦 Tool result',
        toolOutput: `// src/api/items.ts
export async function processItems(items: string[]) {
  const total = items.reduce((sum, item) => sum + item.length, 0);
  const avg = total / items.length;  // ← divides by items.length
  const first = items[0].toUpperCase(); // ← accesses items[0]
  return { averageLength: avg, firstItem: first };
}`,
        delay: 800,
      },
      {
        type: 'thinking',
        content: 'Found two bugs when items is empty: (1) `items.length` is 0, causing division by zero → NaN. (2) `items[0]` is undefined, and `.toUpperCase()` on undefined throws a TypeError. Both cause the 500 error. I need to add a guard clause for empty arrays.',
        label: 'Thinking...',
        delay: 1000,
      },
      {
        type: 'tool_call',
        content: 'I\'ll run the test suite to confirm the failing test and verify my fix.',
        toolName: 'run_command',
        toolArgs: { command: 'npm test -- items.test.ts' },
        label: '🔧 Calling run_command',
        delay: 900,
      },
      {
        type: 'tool_result',
        content: `Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total

FAIL src/api/items.test.ts
  ✓ returns average length for normal input
  ✓ returns first item uppercased
  ✓ handles single-item array
  ✗ handles empty array (expected { averageLength: 0, firstItem: null }, got 500)`,
        label: '📦 Tool result',
        toolOutput: `Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total

FAIL src/api/items.test.ts
  ✓ returns average length for normal input
  ✓ returns first item uppercased
  ✓ handles single-item array
  ✗ handles empty array (expected { averageLength: 0, firstItem: null }, got 500)`,
        delay: 1000,
      },
      {
        type: 'thinking',
        content: 'Confirmed — the empty array test fails with a 500 error. The fix is straightforward: add an early return for empty arrays.',
        label: 'Thinking...',
        delay: 800,
      },
      {
        type: 'response',
        content: `Found the bug! There are **two issues** in \`processItems()\` when given an empty array:

1. **Division by zero**: \`total / items.length\` → \`0 / 0\` = \`NaN\`
2. **Undefined access**: \`items[0]\` is \`undefined\`, and calling \`toUpperCase()\` on it throws a \`TypeError\`

**Here's the fix:**

\`\`\`typescript
export async function processItems(items: string[]) {
  if (items.length === 0) {
    return { averageLength: 0, firstItem: null };
  }
  const total = items.reduce((sum, item) => sum + item.length, 0);
  const avg = total / items.length;
  const first = items[0].toUpperCase();
  return { averageLength: avg, firstItem: first };
}
\`\`\`

The guard clause handles the empty case upfront, avoiding both bugs. The test expects \`{ averageLength: 0, firstItem: null }\` which this fix provides.

Want me to write the fix to the file and re-run the tests?`,
        label: '✨ Final Response',
        delay: 600,
      },
    ],
  },
  {
    id: 'summarize-article',
    title: 'Summarize Article',
    description: 'Agent fetches an article, analyzes it, and produces a summary',
    icon: '📝',
    userPrompt: 'Summarize this article: https://example.com/ai-regulation-2025',
    steps: [
      {
        type: 'thinking',
        content: 'The user wants a summary of an article about AI regulation in 2025. I need to fetch the article content first, then analyze and summarize it.',
        label: 'Thinking...',
        delay: 1200,
      },
      {
        type: 'tool_call',
        content: 'Fetching the article from the provided URL.',
        toolName: 'fetch_url',
        toolArgs: { url: 'https://example.com/ai-regulation-2025' },
        label: '🔧 Calling fetch_url',
        delay: 900,
      },
      {
        type: 'tool_result',
        content: `Title: "The New Framework: How AI Regulation Is Shaping 2025"
Author: Dr. Sarah Chen, Policy Institute
Date: March 2025

The article examines how regulatory frameworks for AI have evolved in 2025. Key points include:

1. The EU AI Act has been fully implemented across all member states, requiring transparency labels on AI-generated content and banning high-risk applications in critical infrastructure.

2. The US has taken a sector-specific approach, with separate rules for healthcare AI (FDA), financial AI (SEC), and educational AI (Department of Education).

3. China has strengthened its algorithm recommendation rules, requiring companies to disclose training data sources and undergo mandatory safety audits.

4. The OECD published updated governance principles emphasizing "proportional regulation" — stricter rules for higher-risk applications, lighter touch for low-risk uses.

5. A new UN working group on AI governance was established, aiming to develop international standards by 2026.

The article argues that while regulation is fragmenting across jurisdictions, there is growing convergence on core principles: transparency, accountability, and human oversight.`,
        label: '📦 Tool result',
        toolOutput: `Title: "The New Framework: How AI Regulation Is Shaping 2025"
Author: Dr. Sarah Chen, Policy Institute
Date: March 2025

The article examines how regulatory frameworks for AI have evolved in 2025. Key points include:

1. The EU AI Act has been fully implemented across all member states, requiring transparency labels on AI-generated content and banning high-risk applications in critical infrastructure.

2. The US has taken a sector-specific approach, with separate rules for healthcare AI (FDA), financial AI (SEC), and educational AI (Department of Education).

3. China has strengthened its algorithm recommendation rules, requiring companies to disclose training data sources and undergo mandatory safety audits.

4. The OECD published updated governance principles emphasizing "proportional regulation" — stricter rules for higher-risk applications, lighter touch for low-risk uses.

5. A new UN working group on AI governance was established, aiming to develop international standards by 2026.

The article argues that while regulation is fragmenting across jurisdictions, there is growing convergence on core principles: transparency, accountability, and human oversight.`,
        delay: 1000,
      },
      {
        type: 'thinking',
        content: 'I have the full article. Now I need to distill it into a concise summary. The key themes are: regional regulatory approaches (EU, US, China), the OECD\'s proportional regulation principle, UN coordination efforts, and the convergence on transparency/accountability/oversight.',
        label: 'Thinking...',
        delay: 900,
      },
      {
        type: 'response',
        content: `**"The New Framework: How AI Regulation Is Shaping 2025"**
*by Dr. Sarah Chen, Policy Institute (March 2025)*

**Summary:**

The article surveys how major jurisdictions are regulating AI in 2025, revealing both fragmentation and emerging convergence.

**Regional approaches:**
- **EU:** Fully implemented AI Act — transparency labels required, high-risk uses banned in critical infrastructure
- **US:** Sector-specific rules (FDA for healthcare AI, SEC for financial AI, Education Dept for educational AI)
- **China:** Strengthened algorithm rules — mandatory training data disclosure and safety audits

**Key trends:**
- The OECD's "proportional regulation" principle gaining traction — stricter rules for higher-risk applications
- New UN working group pursuing international AI governance standards by 2026
- Despite different approaches, all regions converge on three core principles: **transparency, accountability, and human oversight**

**Bottom line:** AI regulation is maturing from theoretical debate to concrete enforcement, with a shared foundation emerging across competing frameworks.`,
        label: '✨ Final Response',
        delay: 600,
      },
    ],
  },
];

/**
 * Get a single scenario by id.
 */
export function getScenarioById(id: string): AgentScenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

/**
 * Get all scenario ids (for the selector).
 */
export function getScenarioIds(): string[] {
  return SCENARIOS.map(s => s.id);
}
