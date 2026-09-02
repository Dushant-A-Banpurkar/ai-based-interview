import { describe, expect, it } from "vitest";
import {
  aggregateMeydaTelemetry,
  RawMeydaFrame,
} from "../utils/meydaAggregator";

describe("aggregateMeydaTelemetry", () => {
  const mockFrames: RawMeydaFrame[] = [
    { rms: 0.05, spectralCentroid: 200, zcr: 5, timestamp: 1000 },
    { rms: 0.15, spectralCentroid: 300, zcr: 15, timestamp: 2000 },
    { rms: 0.10, spectralCentroid: 250, zcr: 10, timestamp: 3000 },
  ];
  it('should return null when passed an empty or undefined frame array', () => {
    expect(aggregateMeydaTelemetry([])).toBeNull();
    // @ts-expect-error testing invalid runtime input
    expect(aggregateMeydaTelemetry(null)).toBeNull();
  });

  it("should correctly compute statistical metrics (mean,min,max,variance,stdDev)", () => {
    const result = aggregateMeydaTelemetry(mockFrames);

    expect(result).not.toBeNull();
    expect(result?.frameCount).toBe(3);
    expect(result?.durationSeconds).toBe(2.0);

    expect(result?.rms.mean).toBe(0.1);
    expect(result?.rms.min).toBe(0.05);
    expect(result?.rms.max).toBe(0.15);
    expect(result?.rms.variance).toBeCloseTo(0.001667, 5);
    expect(result?.rms.stdDev).toBeCloseTo(0.0408, 3);
  });

  it("should calculate silence ratio based on default and custom thresholds", () => {
    const frameWithSilence: RawMeydaFrame[] = [
      { rms: 0.005, spectralCentroid: 100, zcr: 2, timestamp: 1000 },
      { rms: 0.01, spectralCentroid: 120, zcr: 3, timestamp: 2000 },
      { rms: 0.08, spectralCentroid: 220, zcr: 8, timestamp: 3000 },
      { rms: 0.09, spectralCentroid: 240, zcr: 9, timestamp: 4000 },
    ];

    const defaultResult = aggregateMeydaTelemetry(frameWithSilence);
    expect(defaultResult?.silenceRatio).toBe(0.5);

    const customResult = aggregateMeydaTelemetry(frameWithSilence, 0.008);
    expect(customResult?.silenceRatio).toBe(0.25);
  });

  it('should correctly include optional energy metrics when present in frames',()=>{
    const frameWithEnergy:RawMeydaFrame[]=[
        {rms:0.1,spectralCentroid:200,zcr:5,energy:10,timestamp:1000},
        {rms:0.2,spectralCentroid:250,zcr:6,energy:30,timestamp:2000}
    ];

    const result=aggregateMeydaTelemetry(frameWithEnergy);

    expect(result?.energy).toBeDefined();
    expect(result?.energy?.mean).toBe(20);
    expect(result?.energy?.min).toBe(20);
    expect(result?.energy?.max).toBe(20);
  });

  it('should omit energy block if frames do not supply energy',()=>{
    const result=aggregateMeydaTelemetry(mockFrames);
    expect(result?.energy).toBeUndefined();
  });

  it('should classify derived qualitaive insights accurately',()=>{
    const steadyVoiceFrames: RawMeydaFrame[]=Array.from({length:10},(_,i)=>({
        rms:0.10+(i%2===0 ? 0.01 : -0.01),
        spectralCentroid:200+(i*2),
        zcr:5,
        timestamp:1000+i*100
    }));

    const result=aggregateMeydaTelemetry(steadyVoiceFrames);
    expect(result?.derivedInsight.volumeStability).toBe('High');
    expect(result?.derivedInsight.vocalHesitationEstimate).toBe('Low')
  })
});
