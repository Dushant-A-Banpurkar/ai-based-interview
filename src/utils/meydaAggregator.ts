export interface RawMeydaFrame {
  rms: number;
  spectralCentroid: number;
  zcr: number;
  energy?: number;
  timestamp: number;
}

export interface MetricSummary {
  mean: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface AggregatedAudioTelementry {
  frameCount: number;
  durationSeconds: number;
  silecneRatio: number;
  rms: MetricSummary;
  spectralCentroid: MetricSummary;
  zcr: MetricSummary;
  energy?: MetricSummary;
  derivedInsight: {
    volumeStability: "High" | "Moderate" | "Low" | "Unstable";
    pitchVariability: "Monotune" | "Balanced" | "Highly Variable";
    vocalHesitationEstimate: "Low" | "Moderate" | "High";
  };
}

export function aggregateMeydaTelementry(
  frames: RawMeydaFrame[],
  slienceThresholdRms = 0.015,
): AggregatedAudioTelementry | null {
  if (!frames || frames.length === 0) {
    return null;
  }

  const frameCount = frames.length;
  const startTime = frames[0].timestamp;
  const endTime = frames[frameCount - 1].timestamp;
  const durationSeconds = Math.max(0, (endTime - startTime) / 1000);

  const rmsValue = frames.map((f) => f.rms);
  const centroidValues = frames.map((f) => f.spectralCentroid);
  const zcrValues = frames.map((f) => f.zcr);
  const energyValues = frames.some((f) => f.energy !== undefined)
    ? frames.map((f) => f.energy ?? 0)
    : null;

  const slientFrames = rmsValue.filter(
    (rms) => rms < slienceThresholdRms,
  ).length;
  const silenceRatio = Number((slientFrames / frameCount).toFixed(4));

  const computeStats = (values: number[]): MetricSummary => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;

    const varianceSum = values.reduce(
      (acc, val) => acc + Math.pow(val - mean, 2),
      0,
    );
    const variance = varianceSum / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean: Number(mean.toFixed(4)),
      variance: Number(mean.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
    };
  };

  const rmsStats=computeStats(rmsValue);
  const centroidStats=computeStats(centroidValues);
  const zcrStats=computeStats(zcrValues);
  const energyStats=energyValues?computeStats(energyValues):undefined;

  const rmsCV=rmsStats.mean>0?rmsStats.stdDev/rmsStats.mean:0;
  let volumeStability:AggregatedAudioTelementry['derivedInsight']['volumeStability'];
  if(rmsCV<0.35) volumeStability='High';
  else if(rmsCV<0.65) volumeStability='Moderate';
  else if(rmsCV<0.95) volumeStability='Low';
  else volumeStability='Unstable';

  const centroidCV=centroidStats.mean>0?centroidStats.stdDev/centroidStats.mean:0;
  let pitchVariability:AggregatedAudioTelementry['derivedInsight']['pitchVariability'];
  if(centroidCV<0.18) pitchVariability='Monotune';
  else if(centroidCV>0.5) pitchVariability='Highly Variable';

  let vocalHesitationEstimate:AggregatedAudioTelementry['derivedInsight']['vocalHesitationEstimate'];
  if(silenceRatio>0.35 || zcrStats.stdDev>12) vocalHesitationEstimate='High';
  else if(silenceRatio>0.2 || zcrStats.stdDev >6) vocalHesitationEstimate='Moderate';

  return{
    frameCount,
    durationSeconds:Number(durationSeconds.toFixed(2)),
    silenceRatio,
    rms:rmsStats,
    spectralCentroid:centroidCV,
    zcr:zcrStats,
    ...(energyStats && {energy:energyStats}),
    derivedInsight:{
        volumeStability,
        pitchVariability,
        vocalHesitationEstimate
    },

  };
}
