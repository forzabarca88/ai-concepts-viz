import { describe, it, expect } from 'vitest';
import {
  calculateLayerParams,
  buildModelData,
  formatParamCount,
  formatNumber,
  PRESETS,
  generateCustomModel,
} from '../../src/lib/model-anatomy';

describe('calculateLayerParams', () => {
  it('calculates weight count as inputSize * outputSize', () => {
    const result = calculateLayerParams({
      id: 'test',
      name: 'Test',
      description: 'Test layer',
      inputSize: 100,
      outputSize: 200,
      hasBias: false,
      color: '#000',
    });

    expect(result.weightCount).toBe(20000);
    expect(result.biasCount).toBe(0);
    expect(result.totalParams).toBe(20000);
    expect(result.neurons).toBe(200);
  });

  it('includes bias count when hasBias is true', () => {
    const result = calculateLayerParams({
      id: 'test',
      name: 'Test',
      description: 'Test layer',
      inputSize: 100,
      outputSize: 200,
      hasBias: true,
      color: '#000',
    });

    expect(result.weightCount).toBe(20000);
    expect(result.biasCount).toBe(200);
    expect(result.totalParams).toBe(20200);
    expect(result.neurons).toBe(200);
  });
});

describe('buildModelData', () => {
  it('aggregates totals across all layers', () => {
    const model = buildModelData({
      name: 'Test',
      layers: [
        { id: 'l1', name: 'L1', description: '', inputSize: 10, outputSize: 5, hasBias: true, color: '#000' },
        { id: 'l2', name: 'L2', description: '', inputSize: 5, outputSize: 3, hasBias: false, color: '#000' },
      ],
      totalParams: 0,
      totalWeights: 0,
      totalBiases: 0,
      paramSizeGb: 0,
    });

    // L1: 10*5=50 weights + 5 biases = 55
    // L2: 5*3=15 weights + 0 biases = 15
    expect(model.totalWeights).toBe(65);
    expect(model.totalBiases).toBe(5);
    expect(model.totalParams).toBe(70);
    expect(model.layers).toHaveLength(2);
  });

  it('computes FP16 disk size', () => {
    const model = buildModelData({
      name: 'Test',
      layers: [
        { id: 'l1', name: 'L1', description: '', inputSize: 1000, outputSize: 1000, hasBias: true, color: '#000' },
      ],
      totalParams: 0,
      totalWeights: 0,
      totalBiases: 0,
      paramSizeGb: 0,
    });

    // 1M weights + 1000 biases = 1,001,000 params * 2 bytes
    const expectedBytes = 1_001_000 * 2;
    const expectedGb = expectedBytes / (1024 ** 3);
    expect(model.paramSizeGb).toBeCloseTo(expectedGb, 5);
  });
});

describe('formatParamCount', () => {
  it('formats small numbers as-is', () => {
    expect(formatParamCount(100)).toBe('100');
    expect(formatParamCount(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatParamCount(1_000)).toBe('1K');
    expect(formatParamCount(1_500)).toBe('1.5K');
  });

  it('formats millions with M suffix', () => {
    expect(formatParamCount(1_000_000)).toBe('1M');
    expect(formatParamCount(2_500_000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatParamCount(1_000_000_000)).toBe('1B');
    expect(formatParamCount(70_000_000_000)).toBe('70B');
  });

  it('formats trillions with T suffix', () => {
    expect(formatParamCount(1_000_000_000_000)).toBe('1T');
    expect(formatParamCount(1_800_000_000_000)).toBe('1.8T');
  });
});

describe('formatNumber', () => {
  it('adds comma separators', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });
});

describe('PRESETS', () => {
  it('tiny preset has 4 layers', () => {
    expect(PRESETS.tiny.layers).toHaveLength(4);
    expect(PRESETS.tiny.layers[0].id).toBe('embedding');
    expect(PRESETS.tiny.layers[3].id).toBe('output');
  });

  it('small preset has 6 layers', () => {
    expect(PRESETS.small.layers).toHaveLength(6);
  });

  it('large preset has 10 layers', () => {
    expect(PRESETS.large.layers).toHaveLength(10);
  });

  it('all presets have computed totals', () => {
    for (const preset of [PRESETS.tiny, PRESETS.small, PRESETS.large]) {
      expect(preset.totalParams).toBeGreaterThan(0);
      expect(preset.totalWeights).toBeGreaterThan(0);
      expect(preset.totalBiases).toBeGreaterThan(0);
      expect(preset.paramSizeGb).toBeGreaterThan(0);
    }
  });
});

describe('generateCustomModel', () => {
  it('creates embedding + hidden + output layers', () => {
    const model = generateCustomModel(3, 512, 10000);
    expect(model.layers).toHaveLength(5); // 1 embed + 3 hidden + 1 output
    expect(model.layers[0].id).toBe('embedding');
    expect(model.layers[1].id).toBe('hidden-1');
    expect(model.layers[2].id).toBe('hidden-2');
    expect(model.layers[3].id).toBe('hidden-3');
    expect(model.layers[4].id).toBe('output');
  });

  it('scales embedding dim to 2x hidden dim', () => {
    const model = generateCustomModel(2, 256, 5000);
    expect(model.layers[0].outputSize).toBe(512); // 2x 256
    expect(model.layers[1].inputSize).toBe(512);
  });

  it('computes correct totals', () => {
    const model = generateCustomModel(1, 100, 1000);
    // Embedding: 1000 * 200 = 200,000 weights, 0 biases
    // Hidden: 200 * 100 = 20,000 weights, 100 biases
    // Output: 100 * 1000 = 100,000 weights, 1000 biases
    expect(model.totalWeights).toBe(320_000);
    expect(model.totalBiases).toBe(1_100);
  });
});
