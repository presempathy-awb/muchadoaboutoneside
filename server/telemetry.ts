/**
 * Telpher zotel telemetry for the Elysia server. A complete no-op unless
 * TELPHER_TELEMETRY_INGRESS_URL (and its capability) are configured, so
 * laptops, tests, and CI that never set them are untouched. The capability
 * reaches this process only through the environment (hid-in run; see
 * deploy/hid-in/muchadoaboutoneside.hid-in.toml), never a file.
 */
import {
  createElysiaTelemetryLifecycle,
  createElysiaZenohTelemetry,
} from "@telpher/zotel-js-elysia";

type FetchImpl = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface TelemetryOptions {
  /** Overrides process.env.TELPHER_TELEMETRY_INGRESS_URL for tests. */
  ingressUrl?: string;
  /** Overrides process.env.TELPHER_TELEMETRY_INGRESS_CAPABILITY for tests. */
  capability?: string;
  fetchImpl?: FetchImpl;
  runId?: string;
}

interface TelemetryHookContext {
  request: Request;
  response?: unknown;
  route?: string;
  set?: { status?: unknown };
}

export interface TelemetryHooks {
  onRequest: (context: { request: Request }) => void;
  onError: (context: TelemetryHookContext & { error: unknown }) => void;
  onAfterResponse: (context: TelemetryHookContext) => void;
  /** Awaits in-flight emissions; a no-op resolves immediately when disabled. */
  flush: (timeoutMs?: number) => Promise<boolean>;
}

const noopHooks: TelemetryHooks = {
  onRequest() {},
  onError() {},
  onAfterResponse() {},
  async flush() {
    return true;
  },
};

export function createTelemetryHooks(
  options: TelemetryOptions = {},
): TelemetryHooks {
  const ingressUrl =
    options.ingressUrl ?? process.env.TELPHER_TELEMETRY_INGRESS_URL?.trim();
  const capability =
    options.capability ??
    process.env.TELPHER_TELEMETRY_INGRESS_CAPABILITY?.trim();
  if (!ingressUrl || !capability) return noopHooks;

  const telemetry = createElysiaZenohTelemetry({
    serviceName: "muchadoaboutoneside",
    runId: options.runId ?? crypto.randomUUID(),
    ingressUrl,
    capability,
    scope: "prod",
    site: "presvd1",
    node: "muchadoaboutoneside",
    fetchImpl: options.fetchImpl,
  });

  const lifecycle = createElysiaTelemetryLifecycle(telemetry, {
    onTelemetryError: (error) => {
      console.error("[telemetry] delivery failed", error);
    },
  });

  return {
    onRequest: lifecycle.onRequest,
    onError: lifecycle.onError,
    onAfterResponse: lifecycle.onAfterResponse,
    flush: lifecycle.flush,
  };
}
