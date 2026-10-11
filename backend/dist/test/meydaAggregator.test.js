"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const meydaAggregator_1 = require("../utils/meydaAggregator");
(0, vitest_1.describe)("aggregateMeydaTelemetry", () => {
    const mockFrames = [
        { rms: 0.05, spectralCentroid: 200, zcr: 5, timestamp: 1000 },
        { rms: 0.15, spectralCentroid: 300, zcr: 15, timestamp: 2000 },
        { rms: 0.10, spectralCentroid: 250, zcr: 10, timestamp: 3000 },
    ];
    (0, vitest_1.it)('should return null when passed an empty or undefined frame array', () => {
        (0, vitest_1.expect)((0, meydaAggregator_1.aggregateMeydaTelemetry)([])).toBeNull();
        // @ts-expect-error testing invalid runtime input
        (0, vitest_1.expect)((0, meydaAggregator_1.aggregateMeydaTelemetry)(null)).toBeNull();
    });
    (0, vitest_1.it)("should correctly compute statistical metrics (mean,min,max,variance,stdDev)", () => {
        const result = (0, meydaAggregator_1.aggregateMeydaTelemetry)(mockFrames);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result?.frameCount).toBe(3);
        (0, vitest_1.expect)(result?.durationSeconds).toBe(2.0);
        (0, vitest_1.expect)(result?.rms.mean).toBe(0.1);
        (0, vitest_1.expect)(result?.rms.min).toBe(0.05);
        (0, vitest_1.expect)(result?.rms.max).toBe(0.15);
        (0, vitest_1.expect)(result?.rms.variance).toBeCloseTo(0.0017, 4);
        (0, vitest_1.expect)(result?.rms.stdDev).toBeCloseTo(0.0408, 3);
    });
    (0, vitest_1.it)("should calculate silence ratio based on default and custom thresholds", () => {
        const frameWithSilence = [
            { rms: 0.005, spectralCentroid: 100, zcr: 2, timestamp: 1000 },
            { rms: 0.01, spectralCentroid: 120, zcr: 3, timestamp: 2000 },
            { rms: 0.08, spectralCentroid: 220, zcr: 8, timestamp: 3000 },
            { rms: 0.09, spectralCentroid: 240, zcr: 9, timestamp: 4000 },
        ];
        const defaultResult = (0, meydaAggregator_1.aggregateMeydaTelemetry)(frameWithSilence);
        (0, vitest_1.expect)(defaultResult?.silenceRatio).toBe(0.5);
        const customResult = (0, meydaAggregator_1.aggregateMeydaTelemetry)(frameWithSilence, 0.008);
        (0, vitest_1.expect)(customResult?.silenceRatio).toBe(0.25);
    });
    (0, vitest_1.it)('should correctly include optional energy metrics when present in frames', () => {
        const frameWithEnergy = [
            { rms: 0.1, spectralCentroid: 200, zcr: 5, energy: 10, timestamp: 1000 },
            { rms: 0.2, spectralCentroid: 250, zcr: 6, energy: 30, timestamp: 2000 }
        ];
        const result = (0, meydaAggregator_1.aggregateMeydaTelemetry)(frameWithEnergy);
        (0, vitest_1.expect)(result?.energy).toBeDefined();
        (0, vitest_1.expect)(result?.energy?.mean).toBe(20);
        (0, vitest_1.expect)(result?.energy?.min).toBe(10);
        (0, vitest_1.expect)(result?.energy?.max).toBe(30);
    });
    (0, vitest_1.it)('should omit energy block if frames do not supply energy', () => {
        const result = (0, meydaAggregator_1.aggregateMeydaTelemetry)(mockFrames);
        (0, vitest_1.expect)(result?.energy).toBeUndefined();
    });
    (0, vitest_1.it)('should classify derived qualitaive insights accurately', () => {
        const steadyVoiceFrames = Array.from({ length: 10 }, (_, i) => ({
            rms: 0.10 + (i % 2 === 0 ? 0.01 : -0.01),
            spectralCentroid: 200 + (i * 2),
            zcr: 5,
            timestamp: 1000 + i * 100
        }));
        const result = (0, meydaAggregator_1.aggregateMeydaTelemetry)(steadyVoiceFrames);
        (0, vitest_1.expect)(result?.derivedInsight.volumeStability).toBe('High');
        (0, vitest_1.expect)(result?.derivedInsight.vocalHesitationEstimate).toBe('Low');
    });
});
