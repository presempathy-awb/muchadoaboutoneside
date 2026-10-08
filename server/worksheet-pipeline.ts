import { createHmac, timingSafeEqual } from "node:crypto";
import { sanitizeWorksheetGlyphSvg } from "../shared/worksheet-glyph";
import { CALLIGRAPHY_COCKPIT_HOST } from "../shared/worksheet-host";
import { parseWorksheetVisionMeasurements } from "../shared/worksheet-vision";
import { imageRequest, readJson } from "./worksheet-vision";

export interface WorksheetPipelineProfile {
  id: string;
  label: string;
  styleModel: string;
  generatorModel: string;
  reviewModel: string;
  maxRounds: number;
}
export interface WorksheetPipelineOptions {
  url?: string;
  token?: string;
  profiles?: WorksheetPipelineProfile[];
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const states = [
  "accepted",
  "queued",
  "running",
  "held",
  "succeeded",
  "failed",
  "timed_out",
  "canceled",
];
const noStore = { "cache-control": "no-store" };
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: noStore });
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_record");
  return value as Record<string, unknown>;
}
function safeCode(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || !/^[a-z0-9_]{0,100}$/.test(value))
    throw new Error("invalid_code");
  return value;
}
function validGlyph(value: unknown): value is string {
  return (
    typeof value === "string" &&
    [...value].length === 1 &&
    !/[\p{C}\p{Z}]/u.test(value)
  );
}

/** Proxy named jobs with server credentials and signed, job-specific browser access. */
export function createWorksheetPipelineRoute(
  options: WorksheetPipelineOptions = {},
): {
  capability: { available: boolean; profiles: WorksheetPipelineProfile[] };
  submit: (request: Request) => Promise<Response>;
  query: (request: Request) => Promise<Response>;
} {
  // No environment activation: install the registered caller configuration only after helper readiness and review.
  const endpoint = options.url ? new URL(options.url) : undefined;
  const token = options.token ?? "";
  const profiles = (options.profiles ?? []).map((profile) => ({ ...profile }));
  const configured = Boolean(endpoint || token || profiles.length);
  if (
    configured &&
    (!endpoint ||
      !/^[!-~]{20,512}$/.test(token) ||
      !profiles.length ||
      profiles.length > 8)
  )
    throw new Error("Complete registered pipeline configuration is required.");
  if (
    endpoint &&
    (endpoint.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== "/" ||
      endpoint.search ||
      endpoint.hash)
  )
    throw new Error("The pipeline origin must be loopback HTTP.");
  if (
    new Set(profiles.map((profile) => profile.id)).size !== profiles.length ||
    profiles.some(
      (profile) =>
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(profile.id) ||
        !profile.label ||
        profile.label.length > 120 ||
        !Number.isInteger(profile.maxRounds) ||
        profile.maxRounds < 1 ||
        profile.maxRounds > 3 ||
        [profile.styleModel, profile.generatorModel, profile.reviewModel].some(
          (model) =>
            model.length > 180 ||
            !/^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$/.test(model),
        ),
    )
  )
    throw new Error("Invalid registered pipeline profile.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let busy = false;
  let nextAt = -Infinity;
  let windowStart = now();
  let count = 0;
  function guard(request: Request): Response | undefined {
    if (!endpoint)
      return reply(
        {
          error:
            "Glyph rounds are not enabled. Photo sizing and font import remain available.",
        },
        503,
      );
    if (
      ![
        "https://muchadoaboutoneside.com",
        `https://${CALLIGRAPHY_COCKPIT_HOST}`,
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        new URL(request.url).origin,
      ].includes(request.headers.get("origin") ?? "")
    )
      return reply({ error: "Use the glyph controls on this site." }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return reply({ error: "Send glyph requests as JSON." }, 400);
    return undefined;
  }
  const sign = (body: string) =>
    createHmac("sha256", token)
      .update(`worksheet-glyph-v1:${body}`)
      .digest("base64url");
  async function upstream(
    path: string,
    request: Request,
    body?: unknown,
    key?: string,
  ): Promise<Response> {
    if (!endpoint) throw new Error("disabled");
    return fetchImpl(new URL(path, endpoint).href, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return {
    capability: { available: Boolean(endpoint), profiles },
    async submit(request) {
      const blocked = guard(request);
      if (blocked) return blocked;
      if (busy)
        return reply(
          {
            error:
              "Another glyph submission is in progress. Retry the same request later.",
          },
          429,
        );
      busy = true;
      try {
        let input: Record<string, unknown>;
        let row: Record<string, unknown>;
        try {
          row = record(
            await readJson(
              request,
              3_000_000,
              AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
            ),
          );
          if (
            Object.keys(row).some(
              (key) =>
                ![
                  "key",
                  "profile",
                  "glyph",
                  "style",
                  "rounds",
                  "photo",
                ].includes(key),
            )
          )
            throw new Error("unknown_input");
          const profile = profiles.find(
            (candidate) => candidate.id === row.profile,
          );
          if (
            !profile ||
            typeof row.key !== "string" ||
            !uuid.test(row.key) ||
            !validGlyph(row.glyph) ||
            typeof row.style !== "string" ||
            !row.style.trim() ||
            new TextEncoder().encode(row.style).length > 2048 ||
            typeof row.rounds !== "number" ||
            !Number.isInteger(row.rounds) ||
            row.rounds < 1 ||
            row.rounds > profile.maxRounds
          )
            throw new Error("invalid_input");
          input = {
            pipeline: profile.id,
            glyph: row.glyph,
            style: row.style,
            width: 1000,
            height: 1000,
            rounds: row.rounds,
          };
          if (row.photo !== undefined) {
            const photo = imageRequest(row.photo);
            if (
              photo.width > 960 ||
              photo.height > 960 ||
              Buffer.from(photo.image, "base64").length > 2_000_000
            )
              throw new Error("invalid_image");
            input.image_base64 = photo.image;
            input.calibration = {
              pixel_width: photo.width,
              pixel_height: photo.height,
              mm_per_pixel: photo.scale,
            };
          }
        } catch {
          return reply(
            {
              error:
                "Choose one letter, a registered profile, 1–3 rounds and a calibrated photo within 960 pixels.",
            },
            400,
          );
        }
        if (now() - windowStart >= 3_600_000) {
          windowStart = now();
          count = 0;
        }
        if (now() < nextAt || count >= 12)
          return reply(
            {
              error:
                "Glyph submissions are limited. Keep this request and retry later.",
            },
            429,
          );
        count++;
        nextAt = now() + 30_000;
        const response = await upstream(
          "/v1/jobs",
          request,
          { work_type: "calligraphy-glyph-v1", input },
          row.key as string,
        );
        if (!response.ok)
          return reply(
            {
              error:
                "The queue did not accept this request. Retry the same request later.",
            },
            response.status === 409 ? 409 : 503,
          );
        const data = record(record(await readJson(response, 65_536)).data);
        if (
          typeof data.job_id !== "string" ||
          !uuid.test(data.job_id) ||
          !states.includes(String(data.state))
        )
          throw new Error("invalid_receipt");
        const payload = Buffer.from(
          JSON.stringify({
            jobId: data.job_id,
            profile: input.pipeline,
            glyph: input.glyph,
            rounds: input.rounds,
            expires: now() + 86_400_000,
          }),
        ).toString("base64url");
        return reply(
          { access: `${payload}.${sign(payload)}`, state: data.state },
          202,
        );
      } catch {
        return reply(
          {
            error:
              "The submission receipt is uncertain. Retain this request and retry with the same key; do not start a duplicate.",
          },
          502,
        );
      } finally {
        busy = false;
      }
    },
    async query(request) {
      const blocked = guard(request);
      if (blocked) return blocked;
      let row: Record<string, unknown>;
      let job: Record<string, unknown>;
      let profile: WorksheetPipelineProfile;
      try {
        row = record(
          await readJson(
            request,
            4096,
            AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
          ),
        );
        if (
          typeof row.access !== "string" ||
          row.access.length > 1000 ||
          !["progress", "result", "cancel"].includes(String(row.resource))
        )
          throw new Error("invalid_access");
        const parts = row.access.split(".");
        const payload = parts[0] ?? "";
        const supplied = parts[1] ?? "";
        const expected = sign(payload);
        if (
          parts.length !== 2 ||
          supplied.length !== expected.length ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
        )
          throw new Error("invalid_access");
        job = record(
          JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
        );
        const found = profiles.find(
          (candidate) => candidate.id === job.profile,
        );
        if (
          !found ||
          typeof job.jobId !== "string" ||
          !uuid.test(job.jobId) ||
          !validGlyph(job.glyph) ||
          typeof job.rounds !== "number" ||
          !Number.isInteger(job.rounds) ||
          job.rounds < 1 ||
          job.rounds > found.maxRounds ||
          typeof job.expires !== "number" ||
          !Number.isFinite(job.expires) ||
          job.expires <= now()
        )
          throw new Error("expired_access");
        profile = found;
      } catch {
        return reply(
          {
            error:
              "This job access is invalid or expired. No other job can be queried from this sheet.",
          },
          404,
        );
      }
      try {
        const resource = String(row.resource);
        const response = await upstream(
          `/v1/jobs/${job.jobId}/${resource}`,
          request,
          resource === "cancel" ? {} : undefined,
        );
        if (!response.ok)
          return reply(
            {
              error:
                resource === "result" && response.status === 409
                  ? "No accepted glyph is available yet. Check progress."
                  : "The job could not be read. Keep its access and try later.",
            },
            response.status === 409 ? 409 : 503,
          );
        const data = record(record(await readJson(response, 524_288)).data);
        if (resource === "result") {
          const models = record(data.models);
          if (
            data.accepted !== true ||
            data.profile !== job.profile ||
            data.glyph !== job.glyph ||
            typeof data.round !== "number" ||
            !Number.isInteger(data.round) ||
            data.round < 1 ||
            data.round > Number(job.rounds) ||
            models.style !== profile.styleModel ||
            models.generate !== profile.generatorModel ||
            models.review !== profile.reviewModel ||
            typeof data.svg !== "string" ||
            typeof data.feedback !== "string" ||
            data.feedback.length > 2048
          )
            throw new Error("invalid_result");
          let measurements = null;
          if (data.measurements !== null && data.measurements !== undefined) {
            const value = record(data.measurements);
            measurements = parseWorksheetVisionMeasurements({
              xHeightMm: value.x_height_mm,
              lineSpacingMm: value.line_spacing_mm,
              letterWidthMm: value.letter_width_mm,
              confidence: value.confidence,
              notes: value.notes,
            });
          }
          return reply({
            glyph: job.glyph,
            round: data.round,
            svg: sanitizeWorksheetGlyphSvg(data.svg, 1000, 1000),
            feedback: data.feedback,
            models: {
              style: profile.styleModel,
              generate: profile.generatorModel,
              review: profile.reviewModel,
            },
            measurements,
          });
        }
        const status = resource === "progress" ? record(data.job) : data;
        if (
          status.job_id !== job.jobId ||
          !states.includes(String(status.state))
        )
          throw new Error("invalid_status");
        const steps: Record<string, unknown>[] = [];
        if (resource === "progress") {
          if (
            data.profile !== job.profile ||
            !Array.isArray(data.steps) ||
            data.steps.length > 7
          )
            throw new Error("invalid_progress");
          for (const item of data.steps) {
            const step = record(item);
            if (
              typeof step.ordinal !== "number" ||
              !Number.isInteger(step.ordinal) ||
              step.ordinal < 1 ||
              step.ordinal > 7 ||
              !/^(style|generate-[1-3]|review-[1-3])$/.test(
                String(step.step_name),
              ) ||
              (step.step_name !== "style" &&
                Number(String(step.step_name).split("-")[1]) >
                  Number(job.rounds)) ||
              step.model !==
                (step.step_name === "style"
                  ? profile.styleModel
                  : String(step.step_name).startsWith("generate-")
                    ? profile.generatorModel
                    : profile.reviewModel) ||
              !["reserved", "completed", "ambiguous"].includes(
                String(step.state),
              )
            )
              throw new Error("invalid_step");
            if (
              steps.some(
                (previous) =>
                  previous.ordinal === step.ordinal ||
                  previous.name === step.step_name,
              )
            )
              throw new Error("duplicate_step");
            steps.push({
              ordinal: step.ordinal,
              name: step.step_name,
              model: step.model,
              state: step.state,
              errorCode: safeCode(step.error_code),
            });
          }
        }
        return reply({
          state: status.state,
          errorCode: safeCode(status.error_code),
          reconciliationRequired: status.reconciliation_required === true,
          steps: steps.sort((a, b) => Number(a.ordinal) - Number(b.ordinal)),
        });
      } catch {
        return reply(
          {
            error:
              "The job response was unavailable or failed validation. No glyph or sizing was applied.",
          },
          502,
        );
      }
    },
  };
}
