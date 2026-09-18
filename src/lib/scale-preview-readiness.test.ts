import { describe, expect, test } from "bun:test";
import { scalePreviewReadiness } from "./scale-preview-readiness";

const complete = {
  text: "Every word remains",
  showLettering: true,
  hasGeometry: true,
  geometryPending: false,
  geometryError: "",
  layoutPending: false,
  hasTypography: true,
  fontError: "",
  layoutError: "",
};

describe("complete scale preview readiness", () => {
  test("blank and hidden lettering stay viewable when font loading fails", () => {
    for (const fontError of ["", "Font request failed"]) {
      for (const change of [{ text: " \n\t" }, { showLettering: false }]) {
        const state = scalePreviewReadiness({
          ...complete,
          ...change,
          hasTypography: false,
          fontError,
          layoutError: "Stale lettering failure",
        });
        expect(state).toEqual({
          requiresTypography: false,
          pending: false,
          blocked: false,
          ready: true,
        });
      }
    }
  });

  test("visible nonblank words retain the prior complete preview until exact typography succeeds", () => {
    expect(scalePreviewReadiness(complete).ready).toBe(true);
    expect(
      scalePreviewReadiness({ ...complete, hasTypography: false }),
    ).toMatchObject({
      requiresTypography: true,
      pending: true,
      ready: false,
    });
    for (const failure of [
      { fontError: "Unavailable font" },
      { layoutError: "Unsupported glyph" },
    ]) {
      expect(scalePreviewReadiness({ ...complete, ...failure })).toMatchObject({
        blocked: true,
        ready: false,
      });
    }
  });

  test("geometry and unsettled text cannot be bypassed by hiding lettering", () => {
    for (const invalid of [
      { hasGeometry: false },
      { geometryPending: true },
      { geometryError: "Invalid surface" },
      { layoutPending: true },
    ]) {
      expect(
        scalePreviewReadiness({ ...complete, showLettering: false, ...invalid })
          .ready,
      ).toBe(false);
    }
  });
});
