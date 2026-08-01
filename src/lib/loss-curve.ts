// Simulated training loss data for pre-training visualization.
// Models realistic loss decay with noise and occasional spikes.

export interface LossDataPoint {
  epoch: number;
  loss: number;
  learningRate: number;
  tokensSeen: number;
}

/**
 * Generate a realistic pre-training loss curve.
 * Uses exponential decay with noise and occasional gradient spikes.
 */
export function generateLossCurve(
  epochs: number = 100,
  startLoss: number = 5.5,
  endLoss: number = 1.2,
  lrStart: number = 0.0003,
  lrEnd: number = 0.00001,
  tokensPerEpoch: number = 2_500_000_000
): LossDataPoint[] {
  const data: LossDataPoint[] = [];

  // Seeded pseudo-random for reproducibility
  let seed = 42;
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed % 10000) / 10000;
  }

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const progress = epoch / epochs;

    // Exponential decay curve
    const decayRate = 0.045;
    const baseLoss = endLoss + (startLoss - endLoss) * Math.exp(-decayRate * epoch);

    // Add noise that decreases as training progresses
    const noiseLevel = 0.15 * (1 - progress * 0.7);
    const noise = (seededRandom() - 0.5) * 2 * noiseLevel;

    // Occasional gradient spikes (more common early)
    let spike = 0;
    if (seededRandom() < 0.03 * (1 - progress)) {
      spike = seededRandom() * 0.3;
    }

    const loss = Math.max(0.8, baseLoss + noise + spike);

    // Learning rate schedule (warmup then linear decay)
    let lr: number;
    if (epoch <= 5) {
      // Warmup phase
      lr = lrStart * (epoch / 5);
    } else {
      // Linear decay after warmup
      const decayProgress = (epoch - 5) / (epochs - 5);
      lr = lrStart * (1 - decayProgress) + lrEnd * decayProgress;
    }

    const tokensSeen = Math.floor(epoch * tokensPerEpoch);

    data.push({
      epoch,
      loss: parseFloat(loss.toFixed(4)),
      learningRate: parseFloat(lr.toExponential(2)),
      tokensSeen,
    });
  }

  return data;
}

// Pre-generated default dataset for the visualization
export const defaultLossCurve = generateLossCurve();

/**
 * Format a large number of tokens for display.
 */
export function formatTokens(count: number): string {
  if (count >= 1e12) return (count / 1e12).toFixed(1) + 'T';
  if (count >= 1e9) return (count / 1e9).toFixed(1) + 'B';
  if (count >= 1e6) return (count / 1e6).toFixed(1) + 'M';
  return count.toLocaleString();
}
