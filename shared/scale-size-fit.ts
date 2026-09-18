import { resizeScaleDesign, type ScaleDesign } from "./scale-design";
import {
  allocateScaleLettering,
  type ScaleLetteringOptions,
  type ScaleLetteringPlate,
  type ScaleTextRange,
} from "./scale-lettering";
import { normalizeScaleStudySettings } from "./scale-study";

export const MAX_SCALE_SIZE_SEARCH_TRIALS = 18;
export const MAX_SCALE_SIZE_SEARCH_MS = 60_000;
export const MAX_SCALE_SIZE_SEARCH_MODEL_SCALE = normalizeScaleStudySettings({
  modelScale: Number.MAX_VALUE,
}).modelScale;

export interface ScaleSizeFitAssessment {
  placedWordCount: number;
  totalWordCount: number;
}

export interface ScaleSizeFitTrial extends ScaleSizeFitAssessment {
  modelScale: number;
  fits: boolean;
  error?: string;
}

export interface ScaleSizeFitResult {
  status: "fit" | "limit";
  candidate: ScaleDesign | null;
  trials: readonly ScaleSizeFitTrial[];
  reason: string;
}

export interface ScaleSizeFitSearchOptions {
  signal?: AbortSignal;
  onTrial?: (trial: ScaleSizeFitTrial) => void;
  /** May lower the hard bounds, for example for a shorter interactive search. */
  maxTrials?: number;
  maxElapsedMs?: number;
  maxModelScale?: number;
}

type AssessCandidate = (
  candidate: ScaleDesign,
  signal: AbortSignal,
) => Promise<ScaleSizeFitAssessment>;

function cancelError(): DOMException {
  return new DOMException("Model size search cancelled.", "AbortError");
}

function checkedBound(
  value: number | undefined,
  maximum: number,
  name: string,
): number {
  if (value === undefined) return maximum;
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and greater than zero.`);
  return Math.min(value, maximum);
}

/** Abort promptly even if an injected assessor does not observe its signal. */
function assessUntilAborted(
  assess: AssessCandidate,
  candidate: ScaleDesign,
  signal: AbortSignal,
): Promise<ScaleSizeFitAssessment> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return assess(candidate, signal);
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

/**
 * Tests an ascending set of sizes, then refines the first successful bracket.
 * Adaptive density and discrete geometry can be nonmonotonic: the answer is
 * the smallest successful size actually tested, never a global minimum claim.
 */
export async function searchScaleSizeFit(
  design: ScaleDesign,
  assess: AssessCandidate,
  options: ScaleSizeFitSearchOptions = {},
): Promise<ScaleSizeFitResult> {
  if (options.signal?.aborted) throw cancelError();
  const maxTrials = Math.floor(
    checkedBound(options.maxTrials, MAX_SCALE_SIZE_SEARCH_TRIALS, "maxTrials"),
  );
  if (maxTrials < 1) throw new RangeError("maxTrials must be at least one.");
  const maxElapsedMs = checkedBound(
    options.maxElapsedMs,
    MAX_SCALE_SIZE_SEARCH_MS,
    "maxElapsedMs",
  );
  const currentScale = design.geometry.modelScale;
  if (
    !Number.isFinite(currentScale) ||
    currentScale < 0.02 ||
    currentScale > MAX_SCALE_SIZE_SEARCH_MODEL_SCALE
  )
    throw new RangeError("The current model size is outside supported bounds.");
  const maximum = Math.max(
    currentScale,
    checkedBound(
      options.maxModelScale,
      MAX_SCALE_SIZE_SEARCH_MODEL_SCALE,
      "maxModelScale",
    ),
  );
  const controller = new AbortController();
  const cancel = () => controller.abort(cancelError());
  options.signal?.addEventListener("abort", cancel, { once: true });
  const deadline = performance.now() + maxElapsedMs;
  const timeoutError = new DOMException(
    "Model size search reached its time limit.",
    "TimeoutError",
  );
  const timeout = setTimeout(
    () => controller.abort(timeoutError),
    maxElapsedMs,
  );
  const trials: ScaleSizeFitTrial[] = [];
  const totalWordCount = (design.text.match(/\S+/gu) ?? []).length;
  let best: ScaleDesign | null = null;
  let lower = currentScale;
  let timedOut = false;

  const checkDeadline = () => {
    if (options.signal?.aborted) throw cancelError();
    if (performance.now() >= deadline) controller.abort(timeoutError);
    controller.signal.throwIfAborted();
  };
  const test = async (modelScale: number) => {
    checkDeadline();
    const candidate =
      modelScale === currentScale
        ? design
        : resizeScaleDesign(design, modelScale);
    let trial: ScaleSizeFitTrial;
    try {
      const assessment = await assessUntilAborted(
        assess,
        candidate,
        controller.signal,
      );
      checkDeadline();
      if (
        assessment.totalWordCount !== totalWordCount ||
        !Number.isInteger(assessment.placedWordCount) ||
        assessment.placedWordCount < 0 ||
        assessment.placedWordCount > totalWordCount
      )
        throw new Error(
          "The lettering assessment returned invalid word counts.",
        );
      trial = {
        modelScale,
        ...assessment,
        fits: assessment.placedWordCount === totalWordCount,
      };
    } catch (error) {
      checkDeadline();
      trial = {
        modelScale,
        fits: false,
        placedWordCount: 0,
        totalWordCount,
        error:
          error instanceof Error ? error.message : "Size assessment failed.",
      };
    }
    trials.push(trial);
    if (trial.fits && (!best || modelScale < best.geometry.modelScale))
      best = candidate;
    options.onTrial?.(trial);
    checkDeadline();
    return trial.fits;
  };

  try {
    // Leave approximately half the budget for narrowing a successful bracket.
    const coarseCount = Math.min(9, Math.max(2, Math.ceil(maxTrials / 2)));
    for (let index = 0; index < coarseCount; index += 1) {
      if (trials.length >= maxTrials) break;
      const scale =
        index === 0
          ? currentScale
          : index === coarseCount - 1
            ? maximum
            : currentScale *
              (maximum / currentScale) ** (index / (coarseCount - 1));
      if (index > 0 && scale === currentScale) break;
      if (await test(scale)) break;
      lower = scale;
    }
    while (best && trials.length < maxTrials) {
      const upper = (best as ScaleDesign).geometry.modelScale;
      if (upper === currentScale || upper - lower < upper * 0.001) break;
      const middle = Math.sqrt(lower * upper);
      if (!(await test(middle))) lower = middle;
    }
  } catch (error) {
    if (options.signal?.aborted) throw cancelError();
    if (controller.signal.reason !== timeoutError) throw error;
    timedOut = true;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
  if (options.signal?.aborted) throw cancelError();
  const limit = timedOut
    ? `The ${Math.ceil(maxElapsedMs / 1000)}-second time limit was reached.`
    : trials.length >= maxTrials
      ? `The ${maxTrials}-trial limit was reached.`
      : "The planned sizes were checked.";
  if (best) {
    const alreadyFits =
      (best as ScaleDesign).geometry.modelScale === currentScale;
    return {
      status: "fit",
      candidate: best,
      trials,
      reason: alreadyFits
        ? "The writing already fits at the requested font size; the model size is unchanged."
        : `Found the smallest successful model size tested at the requested font size. ${limit} Smaller untested sizes may also fit.`,
    };
  }
  const failedChecks = trials.filter((trial) => trial.error);
  const failureReason = failedChecks.length
    ? ` ${failedChecks.length} size check${failedChecks.length === 1 ? "" : "s"} failed: ${failedChecks.at(-1)?.error}`
    : "";
  return {
    status: "limit",
    candidate: null,
    trials,
    reason: `No fitting model size was verified at the requested font size. ${limit} ${trials.some((trial) => trial.modelScale === maximum) ? "The maximum search size was tested." : "The maximum search size was not reached."}${failureReason}`,
  };
}

/**
 * Reuses the production allocator at the requested writing size, with small
 * plate batches so cancellation and painting can run between allocation work.
 * Range offsets retain scan occurrence identity as the remaining text advances.
 */
export async function assessScaleSizeFit(
  plates: readonly ScaleLetteringPlate[],
  text: string,
  options: ScaleLetteringOptions,
  signal: AbortSignal,
): Promise<ScaleSizeFitAssessment> {
  signal.throwIfAborted();
  const initial = allocateScaleLettering([], text, options);
  const { measure, measureLine } = options;
  let placedWordCount = 0;
  let remainingText = initial.unplacedText;
  for (let start = 0; start < plates.length && remainingText; start += 8) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal.throwIfAborted();
    const offset = placedWordCount;
    const sourceRange = (range: ScaleTextRange | undefined) =>
      range && {
        wordStart: range.wordStart + offset,
        wordEnd: range.wordEnd + offset,
      };
    const batch = allocateScaleLettering(
      plates.slice(start, start + 8),
      remainingText,
      {
        ...options,
        segments: options.segments
          ?.filter((segment) => segment.wordStart >= offset)
          .map((segment) => ({
            wordStart: segment.wordStart - offset,
            wordEnd: segment.wordEnd - offset,
          })),
        measure: measure
          ? (line, size, range) => {
              signal.throwIfAborted();
              return measure(line, size, sourceRange(range));
            }
          : undefined,
        measureLine: measureLine
          ? (line, size, range) => {
              signal.throwIfAborted();
              return measureLine(line, size, sourceRange(range));
            }
          : undefined,
      },
    );
    placedWordCount += batch.placedWordCount;
    remainingText = batch.unplacedText;
  }
  signal.throwIfAborted();
  return { placedWordCount, totalWordCount: initial.totalWordCount };
}
