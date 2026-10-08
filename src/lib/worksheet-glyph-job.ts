export interface Submission {
  key: string;
  profile: string;
  glyph: string;
  style: string;
  rounds: number;
  photo?: {
    dataUrl: string;
    pixelWidth: number;
    pixelHeight: number;
    mmPerPixel: number;
  };
}
export interface PendingJob {
  input: Submission;
  access?: string;
  state: string;
  started: number;
}
/** Restore only a bounded, recent local request; server access is still verified remotely. */
export function restoreWorksheetGlyphJob(
  item: string | null,
  now: number,
): PendingJob | undefined {
  try {
    if (!item || item.length > 3_000_000) return undefined;
    const job = JSON.parse(item) as PendingJob;
    if (
      !job.input ||
      typeof job.input.key !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        job.input.key,
      ) ||
      typeof job.input.glyph !== "string" ||
      [...job.input.glyph].length !== 1 ||
      /[\p{C}\p{Z}]/u.test(job.input.glyph) ||
      typeof job.input.profile !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(job.input.profile) ||
      typeof job.input.style !== "string" ||
      !job.input.style.trim() ||
      new TextEncoder().encode(job.input.style).length > 2048 ||
      typeof job.input.rounds !== "number" ||
      !Number.isInteger(job.input.rounds) ||
      job.input.rounds < 1 ||
      job.input.rounds > 3 ||
      typeof job.state !== "string" ||
      ![
        "receipt_pending",
        "accepted",
        "queued",
        "running",
        "held",
        "succeeded",
        "failed",
        "timed_out",
        "canceled",
      ].includes(job.state) ||
      typeof job.started !== "number" ||
      !Number.isFinite(job.started) ||
      job.started > now ||
      now - job.started > 86_400_000 ||
      (job.access !== undefined &&
        (typeof job.access !== "string" || job.access.length > 1000)) ||
      (job.input.photo !== undefined &&
        (!job.input.photo ||
          typeof job.input.photo.dataUrl !== "string" ||
          job.input.photo.dataUrl.length > 2_800_000 ||
          !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(
            job.input.photo.dataUrl,
          ) ||
          !Number.isInteger(job.input.photo.pixelWidth) ||
          job.input.photo.pixelWidth < 1 ||
          job.input.photo.pixelWidth > 960 ||
          !Number.isInteger(job.input.photo.pixelHeight) ||
          job.input.photo.pixelHeight < 1 ||
          job.input.photo.pixelHeight > 960 ||
          !Number.isFinite(job.input.photo.mmPerPixel) ||
          job.input.photo.mmPerPixel <= 0 ||
          job.input.photo.pixelWidth * job.input.photo.mmPerPixel < 0.1 ||
          job.input.photo.pixelWidth * job.input.photo.mmPerPixel > 5000))
    )
      return undefined;
    return job;
  } catch {
    return undefined;
  }
}
