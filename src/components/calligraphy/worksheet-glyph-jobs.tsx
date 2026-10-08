import { useQuery } from "@tanstack/react-query";
import { type JSX, useEffect, useRef, useState } from "react";
import {
  type PendingJob,
  restoreWorksheetGlyphJob,
  type Submission,
} from "@/lib/worksheet-glyph-job";
import { normalizeWorksheetImage } from "@/lib/worksheet-photo";
import type { WorksheetPhoto } from "@/lib/worksheet-store";
import type { WorksheetPipelineProfile } from "../../../server/worksheet-pipeline";
import { sanitizeWorksheetGlyphSvg } from "../../../shared/worksheet-glyph";
import {
  type WorksheetGlyphProgress as Progress,
  parseWorksheetGlyphProgress,
} from "../../../shared/worksheet-glyph-progress";
import {
  parseWorksheetVisionMeasurements,
  type WorksheetVisionMeasurements,
} from "../../../shared/worksheet-vision";

interface GlyphResult {
  glyph: string;
  round: number;
  svg: string;
  feedback: string;
  measurements: WorksheetVisionMeasurements | null;
}
const savedKey = "worksheet-glyph-job-v1";
const terminal = new Set([
  "held",
  "succeeded",
  "failed",
  "timed_out",
  "canceled",
]);

/** Prefer the registered Qwen 27 workflow while retaining an operator-defined fallback. */
export function selectDefaultGlyphProfile(
  profiles: WorksheetPipelineProfile[],
): WorksheetPipelineProfile | undefined {
  return (
    profiles.find((entry) =>
      [entry.styleModel, entry.reviewModel].some((value) =>
        /qwen[^\n]*(?:27b|\b27\b)/i.test(value),
      ),
    ) ?? profiles[0]
  );
}

/** Keep held jobs available for operator reconciliation and later result checks. */
export function canPrepareAnotherGlyph(state: string): boolean {
  return terminal.has(state) && state !== "held";
}

function restoredJob(): PendingJob | undefined {
  try {
    return restoreWorksheetGlyphJob(
      sessionStorage.getItem(savedKey),
      Date.now(),
    );
  } catch {
    return undefined;
  }
}

/** Explicit, bounded named-job controls; uncertain submissions keep their original key. */
export function WorksheetGlyphJobs({
  photo,
  mmPerPixel,
  onApplySuggestion,
}: {
  photo?: WorksheetPhoto;
  mmPerPixel?: number;
  onApplySuggestion: (
    measurements: WorksheetVisionMeasurements,
  ) => Promise<boolean>;
}): JSX.Element {
  const capability = useQuery<{
    available: boolean;
    profiles: WorksheetPipelineProfile[];
  }>({
    queryKey: ["worksheet-glyph-capability"],
    queryFn: async () => {
      const response = await fetch("/api/worksheet/glyph-jobs", {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("The glyph service could not be checked.");
      return response.json();
    },
  });
  const profiles = capability.data?.profiles ?? [];
  const [profileId, setProfileId] = useState("");
  const profile =
    profiles.find((entry) => entry.id === profileId) ??
    selectDefaultGlyphProfile(profiles);
  const [glyph, setGlyph] = useState("a");
  const [style, setStyle] = useState(
    "Elegant Copperplate: fine hairlines, shaded downstrokes, flowing joins and a consistent 55 degree slant.",
  );
  const [rounds, setRounds] = useState(2);
  const [includePhoto, setIncludePhoto] = useState(false);
  const [job, setJob] = useState<PendingJob | undefined>(restoredJob);
  const [progress, setProgress] = useState<Progress>();
  const [result, setResult] = useState<GlyphResult>();
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const jobStatus = useRef<HTMLParagraphElement>(null);
  const letterInput = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<"status" | "letter" | undefined>(undefined);
  const mounted = useRef(true);
  const activeRequest = useRef(false);
  const checking = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    if (busy || !returnFocus.current) return;
    if (
      (returnFocus.current === "status" && !job) ||
      (returnFocus.current === "letter" && job)
    )
      return;
    (returnFocus.current === "status"
      ? jobStatus.current
      : letterInput.current
    )?.focus();
    returnFocus.current = undefined;
  }, [busy, job]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      checking.current?.abort();
    };
  }, []);
  function remember(next: PendingJob | undefined): void {
    setJob(next);
    try {
      if (next) {
        const encoded = JSON.stringify(next);
        if (encoded.length > 3_000_000)
          throw new Error("job_storage_too_large");
        sessionStorage.setItem(savedKey, encoded);
      } else sessionStorage.removeItem(savedKey);
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not retain job access across reloads. Keep this tab open until the request settles.",
      );
    }
  }
  async function post(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(35_000)])
        : AbortSignal.timeout(35_000),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "The queue request did not finish. Keep the same request key.",
      );
    return data;
  }
  async function submit(): Promise<void> {
    if (!profile || busy || activeRequest.current || job?.access) return;
    activeRequest.current = true;
    setBusy(true);
    setError("");
    let pending = job;
    try {
      if (!pending) {
        if (
          [...glyph].length !== 1 ||
          /[\p{C}\p{Z}]/u.test(glyph) ||
          !style.trim() ||
          new TextEncoder().encode(style).length > 2048
        )
          throw new Error(
            "Choose one printable letter and a style description within 2,048 bytes.",
          );
        let reference: Submission["photo"];
        if (includePhoto) {
          if (!photo || !mmPerPixel)
            throw new Error("Calibrate the photo with a known length first.");
          const mime = photo.dataUrl.startsWith("data:image/png;")
            ? "image/png"
            : "image/jpeg";
          const image = await normalizeWorksheetImage(
            new File(
              [
                Uint8Array.from(atob(photo.dataUrl.split(",")[1] ?? ""), (c) =>
                  c.charCodeAt(0),
                ),
              ],
              "glyph-reference",
              { type: mime },
            ),
            960,
          );
          reference = {
            dataUrl: image.dataUrl,
            pixelWidth: image.pixelWidth,
            pixelHeight: image.pixelHeight,
            mmPerPixel: (mmPerPixel * photo.pixelWidth) / image.pixelWidth,
          };
        }
        if (!mounted.current) return;
        pending = {
          input: {
            key: crypto.randomUUID(),
            profile: profile.id,
            glyph,
            style,
            rounds: Math.min(rounds, profile.maxRounds),
            ...(reference ? { photo: reference } : {}),
          },
          state: "receipt_pending",
          started: Date.now(),
        };
        remember(pending);
      }
      const receipt = await post("/api/worksheet/glyph-jobs", pending.input);
      if (
        typeof receipt.access !== "string" ||
        typeof receipt.state !== "string"
      )
        throw new Error("The receipt is uncertain. Retry this same request.");
      if (mounted.current) {
        returnFocus.current = "status";
        remember({ ...pending, access: receipt.access, state: receipt.state });
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error &&
            ["TimeoutError", "AbortError"].includes(cause.name)
            ? "The receipt is uncertain. Retry the same request key; do not start a duplicate."
            : cause instanceof Error
              ? cause.message
              : "The receipt is uncertain. Retry the same request.",
        );
    } finally {
      activeRequest.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function check(
    resource: "progress" | "cancel" = "progress",
    automatic = false,
  ): Promise<void> {
    if (!job?.access) return;
    if (activeRequest.current) {
      if (resource !== "cancel" || !checking.current || busy) return;
      checking.current.abort();
    }
    const controller = new AbortController();
    checking.current = controller;
    activeRequest.current = true;
    if (!automatic) {
      setBusy(true);
      setError("");
    }
    try {
      const data = await post(
        "/api/worksheet/glyph-jobs/query",
        {
          access: job.access,
          resource,
        },
        controller.signal,
      );
      const next = parseWorksheetGlyphProgress(data);
      if (!mounted.current || controller.signal.aborted) return;
      setProgress(next);
      remember({ ...job, state: next.state });
      if (next.state === "succeeded") {
        const accepted = await post(
          "/api/worksheet/glyph-jobs/query",
          {
            access: job.access,
            resource: "result",
          },
          controller.signal,
        );
        if (
          accepted.glyph !== job.input.glyph ||
          typeof accepted.svg !== "string" ||
          typeof accepted.feedback !== "string" ||
          typeof accepted.round !== "number"
        )
          throw new Error("The accepted letter did not match this request.");
        const checked = {
          glyph: accepted.glyph,
          round: accepted.round,
          svg: sanitizeWorksheetGlyphSvg(accepted.svg, 1000, 1000),
          feedback: accepted.feedback,
          measurements: accepted.measurements
            ? parseWorksheetVisionMeasurements(accepted.measurements)
            : null,
        };
        if (mounted.current && !controller.signal.aborted) setResult(checked);
      }
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The job could not be checked.",
        );
    } finally {
      if (checking.current === controller) {
        checking.current = undefined;
        activeRequest.current = false;
        if (mounted.current && !automatic) setBusy(false);
      }
    }
  }
  // Poll only accepted jobs for 30 minutes while the page is visible. Manual checks remain available.
  const checkLatest = useRef(check);
  checkLatest.current = check;
  useEffect(() => {
    if (!job?.access || terminal.has(job.state)) return;
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - job.started < 1_800_000
      )
        void checkLatest.current("progress", true);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [job?.access, job?.state, job?.started]);
  function download(): void {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.svg], { type: "image/svg+xml" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reviewed-calligraphy-glyph.svg";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return (
    <section className="ws-glyph-jobs" aria-labelledby="ws-glyph-title">
      <h3 id="ws-glyph-title">Shape one letter in rounds</h3>
      <p>
        Use an operator-registered workflow to interpret the style, draw one
        letter, and review it. Each profile fixes the models and bounds the
        rounds.
      </p>
      {!capability.data?.available ? (
        <p role="status" className="ws-choice-effect">
          {capability.isPending
            ? "Checking the glyph service…"
            : capability.isError
              ? "The glyph service could not be checked. Photo sizing remains separate."
              : "Glyph rounds are awaiting service readiness. Photo sizing, manual lettering and font import are available now."}
        </p>
      ) : (
        <>
          <fieldset disabled={busy || Boolean(job)}>
            <label className="ws-field">
              <span>Model profile</span>
              <select
                value={profile?.id ?? ""}
                onChange={(event) => setProfileId(event.target.value)}
              >
                {profiles.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            {profile && (
              <p className="ws-hint">
                Style: {profile.styleModel}
                <br />
                Draw: {profile.generatorModel}
                <br />
                Review: {profile.reviewModel}
              </p>
            )}
            <label className="ws-field">
              <span>Letter to draw</span>
              <input
                ref={letterInput}
                value={glyph}
                onChange={(event) => setGlyph(event.target.value)}
                maxLength={2}
              />
            </label>
            <label className="ws-field">
              <span>Lettering style</span>
              <textarea
                value={style}
                onChange={(event) => setStyle(event.target.value)}
                maxLength={2048}
                rows={4}
              />
            </label>
            <label className="ws-field">
              <span>Maximum rounds</span>
              <select
                value={Math.min(rounds, profile?.maxRounds ?? 1)}
                onChange={(event) => setRounds(Number(event.target.value))}
              >
                {Array.from(
                  { length: profile?.maxRounds ?? 1 },
                  (_, i) => i + 1,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "round" : "rounds"}
                  </option>
                ))}
              </select>
            </label>
            <label className="ws-toggle">
              <input
                type="checkbox"
                checked={includePhoto}
                disabled={!photo || !mmPerPixel}
                onChange={(event) => setIncludePhoto(event.target.checked)}
              />
              <span>Include the calibrated photo as a style reference</span>
            </label>
          </fieldset>
          <p className="ws-choice-effect">
            Starting a job sends the letter, style and any selected photo to the
            glyph queue. Its durable job history retains prompts, photos and
            results; automatic deletion is not yet implemented. Use a practice
            sample you are comfortable retaining.
          </p>
          {!job?.access && (
            <button
              className="ws-primary"
              type="button"
              disabled={busy || !profile}
              onClick={() => void submit()}
            >
              {busy
                ? "Submitting…"
                : job
                  ? "Retry the same request"
                  : "Start letter rounds"}
            </button>
          )}
        </>
      )}
      {storageError && (
        <p className="ws-error" role="alert">
          {storageError}
        </p>
      )}
      {error && (
        <p className="ws-error" role="alert">
          {error}
        </p>
      )}
      {job && (
        <div className="ws-choice-effect">
          <p role="status" ref={jobStatus} tabIndex={-1}>
            Letter “{job.input.glyph}” · {job.state.replaceAll("_", " ")}
          </p>
          {progress?.errorCode && (
            <p>
              The queue reported {progress.errorCode.replaceAll("_", " ")}.
              Check the held-step guidance or ask the service operator before
              retrying model work.
            </p>
          )}
          {job.access &&
            !terminal.has(job.state) &&
            Date.now() - job.started >= 1_800_000 && (
              <p>
                Automatic checks stop after thirty minutes. Use Check job
                progress to continue.
              </p>
            )}
          {progress?.steps.length ? (
            <ol>
              {progress.steps.map((step) => (
                <li key={step.ordinal}>
                  {step.name} · {step.state} <small>{step.model}</small>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              {job.access
                ? "The queue accepted this job. Check progress for its model steps."
                : "Keep the same request until the receipt is known. A retry reuses its original key."}
            </p>
          )}
          {(job.state === "held" || progress?.reconciliationRequired) && (
            <p>
              The queue held an uncertain step for operator reconciliation. The
              queue will not replay it automatically.
            </p>
          )}
          {job.access && (
            <button type="button" disabled={busy} onClick={() => void check()}>
              Check job progress
            </button>
          )}
          {job.access && !terminal.has(job.state) && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void check("cancel")}
              >
                Cancel further rounds
              </button>
              <p>
                Cancellation stops additional model calls after the current call
                returns. It does not immediately interrupt inference or delete
                history.
              </p>
            </>
          )}
          {!job.access && !confirmDiscard && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDiscard(true)}
            >
              Discard this local request
            </button>
          )}
          {!job.access && confirmDiscard && (
            <div className="ws-confirm">
              <p>
                The original request may have been accepted. Discarding only
                forgets this browser request; it does not cancel or delete queue
                history. Starting another request could duplicate it.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  returnFocus.current = "letter";
                  remember(undefined);
                  setConfirmDiscard(false);
                  setError("");
                }}
              >
                Forget this browser request
              </button>
              <button type="button" onClick={() => setConfirmDiscard(false)}>
                Keep request
              </button>
            </div>
          )}
          {canPrepareAnotherGlyph(job.state) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                returnFocus.current = "letter";
                remember(undefined);
                setProgress(undefined);
                setResult(undefined);
                setError("");
              }}
            >
              Prepare another letter
            </button>
          )}
        </div>
      )}
      {result && (
        <div className="ws-choice-effect">
          <h4>Review the accepted letter · round {result.round}</h4>
          <img
            className="ws-glyph-preview"
            width={300}
            height={300}
            alt={`Generated letter ${result.glyph}; review its shape before use`}
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`}
          />
          <p>{result.feedback}</p>
          <button type="button" onClick={download}>
            Download reviewed SVG
          </button>
          {result.measurements && (
            <>
              <p>
                Suggested lowercase height{" "}
                {result.measurements.xHeightMm.toFixed(2)} mm · line spacing{" "}
                {result.measurements.lineSpacingMm.toFixed(2)} mm · width{" "}
                {result.measurements.letterWidthMm.toFixed(2)} mm ·{" "}
                {result.measurements.confidence} confidence. Check against a
                ruler before applying.
              </p>
              <button
                type="button"
                disabled={busy || result.measurements.confidence === "low"}
                onClick={async () => {
                  if (!result.measurements || activeRequest.current) return;
                  activeRequest.current = true;
                  setBusy(true);
                  try {
                    if (!(await onApplySuggestion(result.measurements)))
                      setError(
                        "Sizing was not applied. Review your current draft and try again.",
                      );
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Sizing could not be applied. Your draft is unchanged.",
                    );
                  } finally {
                    activeRequest.current = false;
                    setBusy(false);
                  }
                }}
              >
                Apply reviewed sizing to plain rows
              </button>
            </>
          )}
          <p className="ws-hint">
            Review this letter against your originals, then import approved SVGs
            into FontForge to assemble the font. Check spacing and cursive joins
            before exporting TTF/OTF; bring the finished font back under Find a
            script.
          </p>
        </div>
      )}
    </section>
  );
}
