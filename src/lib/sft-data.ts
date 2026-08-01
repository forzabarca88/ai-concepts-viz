// Instruction/response pairs for the SFT demo component.
// Each pair shows how a base model (before SFT) and an SFT-tuned model (after SFT)
// respond differently to the same instruction.

export interface SFTPair {
  instruction: string;
  beforeSft: string;
  afterSft: string;
  category: 'creative' | 'analytical' | 'practical' | 'technical';
}

export const SFT_EXAMPLES: SFTPair[] = [
  {
    instruction: 'Explain gravity',
    category: 'analytical',
    beforeSft:
      'Gravity is a force that pulls objects together. It was discovered by Isaac Newton when an apple fell from a tree. The formula is F = G * (m1 * m2) / r^2. Gravity keeps planets in orbit around the sun. Einstein later described gravity as the curvature of spacetime caused by mass and energy. On Earth gravity pulls everything toward the center at 9.8 meters per second squared. Without gravity there would be no weight and objects would float away. The moon has less gravity than Earth because it is smaller.',
    afterSft:
      'Gravity is one of the four fundamental forces of nature, and it\'s the one we experience most directly in everyday life. Here\'s how to think about it:\n\n**The basic idea:** Every object with mass attracts every other object with mass. The bigger the objects and the closer they are, the stronger the pull.\n\n**Newton\'s view:** Isaac Newton gave us the formula F = G·(m₁m₂)/r² — essentially, gravitational force depends on both masses and decreases with the square of the distance between them.\n\n**Einstein\'s deeper insight:** Rather than a "force" acting across space, Einstein showed that mass actually warps the fabric of spacetime itself. Imagine placing a bowling ball on a trampoline — smaller balls roll toward it not because of a pull, but because the surface is curved. That\'s gravity.\n\n**Why it matters:** Gravity holds planets in orbit, keeps our atmosphere in place, and is why you stay grounded when you jump. On Earth, everything accelerates downward at 9.8 m/s² regardless of its mass — a feather and a hammer fall at the same rate in a vacuum.',
  },
  {
    instruction: 'Write a poem',
    category: 'creative',
    beforeSft:
      'The sun is shining bright today\nThe birds are singing in the trees\nThe flowers bloom in every way\nThe gentle breeze goes through the seas\n\nThe sky is blue the clouds are white\nThe world is full of many things\nThe morning brings a brand new light\nAnd happiness that joy brings\n\nWe should be happy every day\nAnd enjoy the gifts we receive\nThe night will come but not to stay\nAnd morning brings a brand new lease',
    afterSft:
      '**The Last Train Home**\n\nThe platform hums with half-lit signs,\na flickering bulb above bench three.\nYou check your watch — the 11:47\nis always late, but it arrives.\n\nA student with a guitar case,\na nurse still wearing scrubs,\nall of you carrying the weight\nof twelve hours in cardboard seats.\n\nThe doors close. The train exhales.\nSomewhere between this station and the next,\nyou\'ll forget the argument, the deadline,\nthe thing you said you shouldn\'t have said.\n\nThe tracks unspool through darkened fields,\nand for twenty minutes, nothing exists\nbut the rhythm of steel on steel\nand the quiet thought: *almost home.*',
  },
  {
    instruction: 'Summarize this article',
    category: 'analytical',
    beforeSft:
      'This article is about climate change and how it affects the world. The article says that temperatures are rising and this causes problems like melting ice caps and rising sea levels. Scientists say we need to reduce carbon emissions to stop climate change. The article also talks about renewable energy like solar and wind power. Some countries are doing more than others to fight climate change. The article says that if we don\'t act now it will be too late. Many people are protesting for climate action. The article mentions that extreme weather events are becoming more common.',
    afterSft:
      '**Summary:** The article examines the accelerating impacts of climate change and the urgent need for global action.\n\n**Key points:**\n- Global temperatures continue rising, driving observable effects: melting polar ice, rising sea levels, and more frequent extreme weather events\n- Scientists emphasize that reducing carbon emissions is critical to limiting further warming\n- Renewable energy (solar, wind) is presented as a viable transition path away from fossil fuels\n- International response is uneven — some nations lead on climate policy while others lag\n- Public pressure through protests and activism is pushing governments toward stronger commitments\n\n**Bottom line:** The article argues that the window for meaningful action is narrowing and that coordinated global effort is essential to avoid irreversible consequences.',
  },
  {
    instruction: 'Help me debug my code',
    category: 'technical',
    beforeSft:
      'To debug your code you need to find the error. First look at the error message. The error message tells you what is wrong. You can use a debugger to step through your code. Print statements also help find bugs. Check your variable names to make sure they are correct. Make sure your syntax is right. Look for typos. Check that your loops are not infinite. Make sure your functions return the right values. Test your code with different inputs. If you still can\'t find the bug ask someone else to look at it.',
    afterSft:
      'Happy to help! To give you the best guidance, I need a bit more info:\n\n1. **What language/framework** are you working in?\n2. **What\'s the error message?** (paste it if you can)\n3. **What were you expecting** vs. what actually happened?\n\nIn the meantime, here\'s a systematic debugging approach:\n\n**Step 1 — Read the error carefully**\nThe error message usually tells you the file, line number, and type of problem. Don\'t skip this.\n\n**Step 2 — Isolate the problem**\nComment out sections of code until the error disappears, then bring things back one piece at a time to find the culprit.\n\n**Step 3 — Check the usual suspects:**\n- Off-by-one errors in loops and array indices\n- Undefined/null values being accessed\n- Variable scoping issues\n- Async operations not properly awaited\n\nShare your code and error and I\'ll take a look!',
  },
  {
    instruction: 'What should I have for dinner?',
    category: 'practical',
    beforeSft:
      'You could have pizza for dinner. Pizza is a popular food that many people enjoy. You can get pizza delivered or make it yourself. Another option is pasta. Pasta is also popular and easy to make. You could also have a sandwich or a salad. If you want something healthy you could have grilled chicken with vegetables. If you want something quick you could have cereal or toast. It depends on what you like and what ingredients you have available.',
    afterSft:
      'That depends on a few things — let me narrow it down:\n\n**If you want quick & easy (under 15 min):**\n- Smash burgers with fried onions\n- Ramen with a soft-boiled egg and green onions\n- Quesadillas with whatever cheese you have\n\n**If you want to cook something satisfying:**\n- Sheet pan salmon with roasted asparagus and lemon\n- Stir-fry with chicken, bell peppers, and soy-ginger sauce\n- Shakshuka (eggs poached in spiced tomato sauce) — great with crusty bread\n\n**If you\'re in a vegetarian mood:**\n- Chickpea curry with rice\n- Mushroom risotto\n- Loaded grilled cheese with tomato soup\n\nTell me what ingredients you have on hand or what flavor profile you\'re craving, and I\'ll give you a specific recipe!',
  },
];

/**
 * Get a single example by index.
 */
export function getSFTExample(index: number): SFTPair | undefined {
  return SFT_EXAMPLES[index];
}

/**
 * Get all example instructions (for the selector).
 */
export function getInstructionLabels(): string[] {
  return SFT_EXAMPLES.map(ex => `${ex.instruction} (${ex.category})`);
}
