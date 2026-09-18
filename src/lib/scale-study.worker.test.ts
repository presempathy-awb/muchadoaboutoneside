import { describe, expect, test } from "bun:test";
import { DEFAULT_SCALE_STUDY_SETTINGS } from "../../shared/scale-study";
import type { ScaleStudyResponse } from "./use-scale-study";

function request(worker: Worker, data: unknown, timeoutMs = 5000) {
  return new Promise<ScaleStudyResponse>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Scale worker did not respond.")),
      timeoutMs,
    );
    worker.onmessage = (event: MessageEvent<ScaleStudyResponse>) => {
      clearTimeout(timeout);
      resolve(event.data);
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      reject(new Error(event.message));
    };
    worker.postMessage(data);
  });
}

function createWorker() {
  return new Worker(new URL("./scale-study.worker.ts", import.meta.url), {
    type: "module",
  });
}

const settings = { ...DEFAULT_SCALE_STUDY_SETTINGS, columns: 4, rows: 2 };

describe("scale study worker boundary", () => {
  test("returns independent build IDs with structured-clone geometry", async () => {
    const worker = createWorker();
    try {
      const first = await request(worker, { requestId: 17, settings });
      expect(first.requestId).toBe(17);
      expect(first.error).toBe("");
      expect(first.study?.plates.length).toBeGreaterThan(0);
      expect(first.study?.triangleCount).toBeGreaterThan(0);
      expect(
        first.study?.plates.every((plate) =>
          plate.positions.every(Number.isFinite),
        ),
      ).toBe(true);

      const second = await request(worker, {
        requestId: 18,
        settings: { ...settings, seed: 99 },
      });
      expect(second.requestId).toBe(18);
      expect(second.error).toBe("");
      expect(second.study?.plates[0]?.positions).not.toEqual(
        first.study?.plates[0]?.positions,
      );
    } finally {
      worker.terminate();
    }
  });

  test("bounds oversized geometry settings before dispatch", async () => {
    const worker = createWorker();
    try {
      const result = await request(worker, {
        requestId: 20,
        settings: {
          ...settings,
          modelId: "unknown",
          columns: 20000,
          rows: 20000,
          modelScale: 1,
          supportOffsetInches: 0,
          relief: 0,
        },
      });
      expect(result.error).toBe("");
      expect(result.study?.modelId).toBe("archival");
      expect(result.study?.plates.length).toBeGreaterThan(0);
      expect(result.study?.plates.length).toBeLessThanOrEqual(1200);
    } finally {
      worker.terminate();
    }
  });

  test("reports invalid requests and can still process the next valid build", async () => {
    const worker = createWorker();
    try {
      const rejected = await request(worker, { requestId: 23, settings: null });
      expect(rejected).toEqual({
        requestId: 23,
        study: null,
        error: "The scale build request needs geometry settings.",
      });
      const recovered = await request(worker, { requestId: 24, settings });
      expect(recovered.requestId).toBe(24);
      expect(recovered.error).toBe("");
      expect(recovered.study?.plates.length).toBeGreaterThan(0);
    } finally {
      worker.terminate();
    }
  });

  test("dispatches the printable source without substituting archival proportions", async () => {
    const worker = createWorker();
    try {
      const result = await request(
        worker,
        {
          requestId: 31,
          settings: {
            ...settings,
            modelId: "maquette",
            modelScale: 1,
            supportOffsetInches: 0,
            relief: 0,
          },
        },
        15000,
      );
      expect(result.error).toBe("");
      expect(result.study?.modelId).toBe("maquette");
      expect(result.study?.modelScale).toBe(1);
      const vertices = result.study?.sourceGeometry?.positions;
      expect(vertices?.length).toBeGreaterThan(0);
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (let index = 1; index < (vertices?.length ?? 0); index += 3) {
        minY = Math.min(minY, vertices?.[index] ?? 0);
        maxY = Math.max(maxY, vertices?.[index] ?? 0);
      }
      expect((maxY - minY) * 25.4).toBeCloseTo(180, 3);
    } finally {
      worker.terminate();
    }
  }, 20000);
});
