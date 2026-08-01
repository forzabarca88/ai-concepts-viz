// Response pairs for the PreferenceChart component.
// Each pair represents two candidate responses to the same prompt,
// along with a reward model score for each response.
// The "chosen" field indicates which response humans prefer.

export interface ResponsePair {
  id: number;
  prompt: string;
  responseA: string;
  responseB: string;
  rewardA: number; // reward model score for A (0-10 scale)
  rewardB: number; // reward model score for B (0-10 scale)
  chosen: 'A' | 'B'; // which one humans prefer
  category: string;
}

export const PREFERENCE_PAIRS: ResponsePair[] = [
  {
    id: 1,
    prompt: 'What causes the seasons?',
    category: 'science',
    responseA:
      'The seasons are caused by the tilt of the Earth\'s axis. The Earth is tilted at about 23.5 degrees. When the Northern Hemisphere is tilted toward the sun, it is summer there. When it is tilted away, it is winter. The Southern Hemisphere has opposite seasons. The distance from the sun does not cause the seasons.',
    responseB:
      'The seasons are caused by the Earth being closer to or farther from the sun at different times of year.',
    rewardA: 8.2,
    rewardB: 2.1,
    chosen: 'A',
  },
  {
    id: 2,
    prompt: 'Write a short story about a lighthouse keeper.',
    category: 'creative',
    responseA:
      'The lighthouse keeper checked his watch. 3 AM. He had been alone on the island for six months now. The light rotated steadily, its beam cutting through the fog like a blade. He made tea and sat by the window, watching the dark water. A ship passed in the distance — he saw its running lights, steady and calm. He felt a quiet satisfaction. This was his purpose: to be the one who watches.',
    responseB:
      'Once upon a time there was a lighthouse keeper who lived in a lighthouse. Every night he would turn on the light so ships could see it. One night there was a big storm and the light went out. The keeper fixed it quickly and saved a ship from crashing. The end.',
    rewardA: 8.7,
    rewardB: 3.4,
    chosen: 'A',
  },
  {
    id: 3,
    prompt: 'How do I center a div in CSS?',
    category: 'technical',
    responseA:
      'Here are the most common ways to center a div, from simplest to most flexible:\n\n**Flexbox (recommended):**\n```css\n.parent {\n  display: flex;\n  justify-content: center;  /* horizontal */\n  align-items: center;      /* vertical */\n}\n```\n\n**Grid:**\n```css\n.parent {\n  display: grid;\n  place-items: center;\n}\n```\n\n**Absolute positioning:**\n```css\n.child {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n}\n```\n\nFlexbox is the most widely used approach. Grid\'s `place-items` is the cleanest single-property solution.',
    responseB:
      'You can center a div by using margin: auto. You can also use text-align: center. Or you could use position absolute and set top and left to 50%. There are many ways to center things in CSS.',
    rewardA: 9.1,
    rewardB: 4.5,
    chosen: 'A',
  },
  {
    id: 4,
    prompt: 'I\'m feeling anxious about a presentation tomorrow. Any tips?',
    category: 'advice',
    responseA:
      'It\'s completely normal to feel anxious before a presentation — even experienced speakers get nervous. Here are a few things that can help:\n\n**Tonight:**\n- Review your material one more time, then put it away. Don\'t cram.\n- Get a solid night\'s sleep — that\'s more valuable than extra rehearsal.\n- Visualize yourself giving a calm, confident talk.\n\n**Right before you start:**\n- Take three slow, deep breaths (4 seconds in, 6 seconds out).\n- Stand tall — your posture affects how your brain interprets the situation.\n- Remember: your audience wants you to succeed. They\'re on your side.\n\n**During:**\n- Start with a pause. Look at a friendly face. Then begin.\n- If you stumble, just keep going. Audiences rarely notice minor slips.\n\nYou\'ve prepared. You know this material. You\'ll be fine.',
    responseB:
      'Don\'t worry, presentations are easy. Just stand up and talk. If you\'re nervous, drink some water. Practice what you\'re going to say. Most people don\'t pay attention anyway, so it doesn\'t matter if you mess up.',
    rewardA: 9.3,
    rewardB: 2.8,
    chosen: 'A',
  },
  {
    id: 5,
    prompt: 'Explain how a blockchain works.',
    category: 'science',
    responseA:
      'Think of a blockchain as a shared digital notebook that everyone can read but no one can alter retroactively. Here\'s how it works:\n\n**Blocks:** Information is grouped into "blocks" — batches of transactions or records.\n\n**Chaining:** Each block contains a cryptographic hash of the previous block. This creates an unbreakable chain: if you try to change anything in block 3, the hash changes, which breaks the link to block 4, and so on.\n\n**Consensus:** Instead of a central authority, the network of participants agrees on which blocks are valid. In Bitcoin, this is done through "proof of work" — computers compete to solve a puzzle, and the winner gets to add the next block.\n\n**Why it matters:** No single entity controls the data. Once something is recorded, it\'s practically impossible to alter. This makes blockchains useful for anything requiring trustless verification — cryptocurrency, supply chains, voting systems.\n\n**The tradeoff:** This decentralization comes at a cost — blockchains are slower and more energy-intensive than centralized databases.',
    responseB:
      'A blockchain is a database that is shared across many computers. Each block contains transactions. The blocks are linked together using cryptography. Bitcoin uses blockchain technology. It\'s secure because everyone has a copy and you can\'t change it without everyone noticing.',
    rewardA: 8.9,
    rewardB: 5.2,
    chosen: 'A',
  },
  {
    id: 6,
    prompt: 'Recommend a beginner-friendly hiking trail near Portland.',
    category: 'advice',
    responseA:
      'Here are a few great beginner-friendly hikes within an hour of Portland:\n\n**1. Pittock Mansion (easy, 0.4 mi round-trip)**\n- Flat walk up to a historic mansion with panoramic city views\n- Paved paths, great for first-timers\n- Free and open year-round\n\n**2. Powell Butte Nature Preserve (easy-moderate, 1.5 mi loop)**\n- A dormant volcanic plug with forest trails and a 360° summit view\n- Stairs to the summit, but the loop trail is gentle\n- Parking can fill on weekends — go early\n\n**3. West Hills Reservoir (easy, 1.2 mi loop)**\n- Peaceful trail around a reservoir with wildflowers in spring\n- Mostly flat with a few gentle inclines\n- Dogs allowed on leash\n\n**Tips for your first hike:**\n- Wear shoes with grip (trail conditions vary)\n- Bring more water than you think you need\n- Check trail conditions online before heading out\n- Start short — build up gradually',
    responseB:
      'You can hike at Forest Park — it has lots of trails. Try the Timberland Trail, it\'s very long. There\'s also Tryon Creek State Park which has some nice walking paths. Make sure to bring water and wear good shoes.',
    rewardA: 9.0,
    rewardB: 4.1,
    chosen: 'A',
  },
];

/**
 * Compute alignment score from a set of votes.
 * Returns a value between 0 and 1, where 1 means the reward model
 * perfectly matches human preferences.
 */
export function computeAlignmentScore(
  pairs: ResponsePair[],
  votes: Record<number, 'A' | 'B'>
): number {
  if (pairs.length === 0) return 0;
  let correct = 0;
  let total = 0;
  for (const pair of pairs) {
    const vote = votes[pair.id];
    if (vote) {
      total++;
      if (vote === pair.chosen) {
        correct++;
      }
    }
  }
  return total > 0 ? correct / total : 0;
}

/**
 * Generate alignment progress curve data points.
 * Simulates how alignment score improves as more preference data is collected.
 * Returns an array of { step, score } objects for the chart.
 */
export function generateAlignmentCurve(
  _pairs: ResponsePair[],
  numSteps: number = 50
): { step: number; score: number }[] {
  const curve: { step: number; score: number }[] = [];

  // Simulate progressive training: each step adds more preference data
  // and the model's alignment improves following a sigmoid-like curve
  const baseScore = 0.55; // starting alignment (slightly above random)
  const targetScore = 0.92; // target alignment after sufficient training
  const rate = 0.12; // learning rate for alignment improvement

  for (let step = 0; step <= numSteps; step++) {
    const progress = step / numSteps;
    // Sigmoid curve: rapid early improvement that plateaus
    const improvement = (targetScore - baseScore) / (1 + Math.exp(-rate * (progress * 10 - 5)));
    const score = baseScore + improvement;
    curve.push({ step, score: Math.min(score, targetScore) });
  }

  return curve;
}

/**
 * Get a single preference pair by ID.
 */
export function getPreferencePair(id: number): ResponsePair | undefined {
  return PREFERENCE_PAIRS.find(p => p.id === id);
}

/**
 * Get the reward difference for a pair (chosen - rejected).
 * Positive values indicate how strongly the reward model agrees with the preference.
 */
export function getRewardDelta(pair: ResponsePair): number {
  return pair.chosen === 'A' ? pair.rewardA - pair.rewardB : pair.rewardB - pair.rewardA;
}
