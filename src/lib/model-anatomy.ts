// Model anatomy — data and logic for neural network parameter calculations.
// Used by the ModelAnatomy D3 visualization component.

export interface LayerConfig {
  id: string;
  name: string;
  description: string;
  inputSize: number;
  outputSize: number;
  hasBias: boolean;
  color: string;
}

export interface LayerData {
  id: string;
  name: string;
  description: string;
  inputSize: number;
  outputSize: number;
  hasBias: boolean;
  weightCount: number;
  biasCount: number;
  totalParams: number;
  color: string;
  neurons: number;
}

export interface ModelConfig {
  name: string;
  layers: LayerConfig[];
  totalParams: number;
  totalWeights: number;
  totalBiases: number;
  paramSizeGb: number;
}

/**
 * Calculate parameter counts for a layer.
 * Weights: inputSize * outputSize (dense/fully-connected)
 * Biases: outputSize (if hasBias)
 */
export function calculateLayerParams(
  config: LayerConfig
): Pick<LayerData, 'weightCount' | 'biasCount' | 'totalParams' | 'neurons'> {
  const weightCount = config.inputSize * config.outputSize;
  const biasCount = config.hasBias ? config.outputSize : 0;
  return {
    weightCount,
    biasCount,
    totalParams: weightCount + biasCount,
    neurons: config.outputSize,
  };
}

/**
 * Build full layer data from a model config.
 */
export function buildModelData(config: ModelConfig): ModelConfig & {
  layers: LayerData[];
} {
  const layers: LayerData[] = config.layers.map(layer => {
    const params = calculateLayerParams(layer);
    return {
      id: layer.id,
      name: layer.name,
      description: layer.description,
      inputSize: layer.inputSize,
      outputSize: layer.outputSize,
      hasBias: layer.hasBias,
      color: layer.color,
      ...params,
    };
  });

  const totalWeights = layers.reduce((sum, l) => sum + l.weightCount, 0);
  const totalBiases = layers.reduce((sum, l) => sum + l.biasCount, 0);
  const totalParams = totalWeights + totalBiases;

  return {
    ...config,
    layers,
    totalWeights,
    totalBiases,
    totalParams,
    paramSizeGb: totalParams * 2 / (1024 ** 3), // FP16 = 2 bytes per param
  };
}

/**
 * Format a number as a readable string (K, M, B, T suffixes).
 */
export function formatParamCount(count: number): string {
  if (count >= 1e12) return (count / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
  if (count >= 1e9) return (count / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (count >= 1e6) return (count / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (count >= 1e3) return (count / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return count.toString();
}

/**
 * Format a number with commas for display.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Preset model configurations ─────────────────────────────────────

/**
 * Tiny model — for demonstration with small numbers.
 * Input: 768 (token embedding dim)
 * Hidden: 2 layers of 256 neurons
 * Output: 768 (back to vocab size for simplicity)
 */
export const MODEL_TINY: ModelConfig = {
  name: 'Tiny (768 → 256 → 256 → 768)',
  layers: [
    {
      id: 'embedding',
      name: 'Embedding',
      description: 'Converts token IDs to dense vectors. Each of the 32K vocab tokens maps to a 768-dim vector.',
      inputSize: 32000,
      outputSize: 768,
      hasBias: false,
      color: '#5E5CE6',
    },
    {
      id: 'hidden-1',
      name: 'Hidden Layer 1',
      description: 'First transformation layer. Maps 768-dim input to 256-dim representation.',
      inputSize: 768,
      outputSize: 256,
      hasBias: true,
      color: '#7B79D6',
    },
    {
      id: 'hidden-2',
      name: 'Hidden Layer 2',
      description: 'Second transformation layer. Further processes the 256-dim representation.',
      inputSize: 256,
      outputSize: 256,
      hasBias: true,
      color: '#9896C6',
    },
    {
      id: 'output',
      name: 'Output',
      description: 'Maps back to vocab space. Produces scores for each of the 32K tokens.',
      inputSize: 256,
      outputSize: 32000,
      hasBias: true,
      color: '#B5B3B6',
    },
  ],
  totalParams: 0,
  totalWeights: 0,
  totalBiases: 0,
  paramSizeGb: 0,
};

/**
 * Small model — illustrative mid-size.
 * Input: 4096 (token embedding dim)
 * Hidden: 4 layers of 1024 neurons
 * Output: 4096
 */
export const MODEL_SMALL: ModelConfig = {
  name: 'Small (4096 → 1024 × 4 → 4096)',
  layers: [
    {
      id: 'embedding',
      name: 'Embedding',
      description: 'Converts token IDs to 4096-dim vectors from a 50K vocabulary.',
      inputSize: 50000,
      outputSize: 4096,
      hasBias: false,
      color: '#5E5CE6',
    },
    {
      id: 'hidden-1',
      name: 'Hidden Layer 1',
      description: 'Maps 4096-dim input to 1024-dim representation.',
      inputSize: 4096,
      outputSize: 1024,
      hasBias: true,
      color: '#7B79D6',
    },
    {
      id: 'hidden-2',
      name: 'Hidden Layer 2',
      description: 'Processes the 1024-dim representation further.',
      inputSize: 1024,
      outputSize: 1024,
      hasBias: true,
      color: '#9896C6',
    },
    {
      id: 'hidden-3',
      name: 'Hidden Layer 3',
      description: 'Deepens the representation with another 1024-dim layer.',
      inputSize: 1024,
      outputSize: 1024,
      hasBias: true,
      color: '#A8A5C0',
    },
    {
      id: 'hidden-4',
      name: 'Hidden Layer 4',
      description: 'Final hidden layer before output projection.',
      inputSize: 1024,
      outputSize: 1024,
      hasBias: true,
      color: '#B5B3B6',
    },
    {
      id: 'output',
      name: 'Output',
      description: 'Projects back to vocab space — 50K token scores.',
      inputSize: 1024,
      outputSize: 50000,
      hasBias: true,
      color: '#C2C0C3',
    },
  ],
  totalParams: 0,
  totalWeights: 0,
  totalBiases: 0,
  paramSizeGb: 0,
};

/**
 * Large model — illustrative large-scale model.
 * Input: 12288 (token embedding dim)
 * Hidden: 8 layers of 4096 neurons
 * Output: 12288
 */
export const MODEL_LARGE: ModelConfig = {
  name: 'Large (12288 → 4096 × 8 → 12288)',
  layers: [
    {
      id: 'embedding',
      name: 'Embedding',
      description: 'Converts token IDs to 12288-dim vectors from a 100K vocabulary.',
      inputSize: 100000,
      outputSize: 12288,
      hasBias: false,
      color: '#5E5CE6',
    },
    {
      id: 'hidden-1',
      name: 'Hidden Layer 1',
      description: 'Maps 12288-dim input to 4096-dim representation.',
      inputSize: 12288,
      outputSize: 4096,
      hasBias: true,
      color: '#6B69F0',
    },
    {
      id: 'hidden-2',
      name: 'Hidden Layer 2',
      description: 'Processes 4096-dim representation.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#7B79D6',
    },
    {
      id: 'hidden-3',
      name: 'Hidden Layer 3',
      description: 'Deepens the representation.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#8A88CC',
    },
    {
      id: 'hidden-4',
      name: 'Hidden Layer 4',
      description: 'Continues transformation.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#9896C6',
    },
    {
      id: 'hidden-5',
      name: 'Hidden Layer 5',
      description: 'Further abstracts features.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#A8A5C0',
    },
    {
      id: 'hidden-6',
      name: 'Hidden Layer 6',
      description: 'Extracts higher-order patterns.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#B5B3B6',
    },
    {
      id: 'hidden-7',
      name: 'Hidden Layer 7',
      description: 'Refines the representation.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#C2C0C3',
    },
    {
      id: 'hidden-8',
      name: 'Hidden Layer 8',
      description: 'Final hidden layer before output projection.',
      inputSize: 4096,
      outputSize: 4096,
      hasBias: true,
      color: '#CECCCF',
    },
    {
      id: 'output',
      name: 'Output',
      description: 'Projects back to vocab space — 100K token scores.',
      inputSize: 4096,
      outputSize: 100000,
      hasBias: true,
      color: '#DADADA',
    },
  ],
  totalParams: 0,
  totalWeights: 0,
  totalBiases: 0,
  paramSizeGb: 0,
};

// Pre-compute the model data for each preset
export const PRESETS = {
  tiny: buildModelData(MODEL_TINY),
  small: buildModelData(MODEL_SMALL),
  large: buildModelData(MODEL_LARGE),
};

/**
 * Generate a custom model with the given number of hidden layers and hidden dim.
 * Embedding dim = hidden dim * 2 (typical for attention models).
 * Vocab size scales with model size.
 */
export function generateCustomModel(
  hiddenLayers: number,
  hiddenDim: number,
  vocabSize: number
): ModelConfig {
  const embedDim = hiddenDim * 2;
  const layers: LayerConfig[] = [];

  // Embedding layer
  layers.push({
    id: 'embedding',
    name: 'Embedding',
    description: `Converts token IDs to ${embedDim}-dim vectors from a ${vocabSize.toLocaleString()} vocabulary.`,
    inputSize: vocabSize,
    outputSize: embedDim,
    hasBias: false,
    color: '#5E5CE6',
  });

  // Hidden layers
  const violetShades = ['#5E5CE6', '#6B69F0', '#7B79D6', '#8A88CC', '#9896C6', '#A8A5C0', '#B5B3B6', '#C2C0C3', '#CECCCF', '#DADADA'];
  for (let i = 0; i < hiddenLayers; i++) {
    const inputSize = i === 0 ? embedDim : hiddenDim;
    layers.push({
      id: `hidden-${i + 1}`,
      name: `Hidden Layer ${i + 1}`,
      description: i === 0
        ? `Maps ${embedDim}-dim input to ${hiddenDim}-dim representation.`
        : `Processes ${hiddenDim}-dim representation.`,
      inputSize,
      outputSize: hiddenDim,
      hasBias: true,
      color: violetShades[i % violetShades.length],
    });
  }

  // Output layer
  layers.push({
    id: 'output',
    name: 'Output',
    description: `Projects back to vocab space — ${vocabSize.toLocaleString()} token scores.`,
    inputSize: hiddenDim,
    outputSize: vocabSize,
    hasBias: true,
    color: violetShades[hiddenLayers % violetShades.length],
  });

  return buildModelData({
    name: `Custom (${embedDim} → ${hiddenDim} × ${hiddenLayers} → ${embedDim})`,
    layers,
    totalParams: 0,
    totalWeights: 0,
    totalBiases: 0,
    paramSizeGb: 0,
  }) as ModelConfig;
}
