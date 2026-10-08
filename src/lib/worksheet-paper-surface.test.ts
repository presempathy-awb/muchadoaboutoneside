import { expect, test } from "bun:test";
import { paperSurface, paperSurfaceNote } from "./worksheet-paper-surface";

test("paper previews default to printer paper and preserve custom notes when switched", () => {
  expect(paperSurface("")).toBe("printer");
  expect(
    paperSurface("Translucent tracing paper / drafting vellum · My pad"),
  ).toBe("vellum");
  expect(paperSurfaceNote("My handmade sheet", "vellum")).toBe(
    "Translucent tracing paper / drafting vellum · My handmade sheet",
  );
  expect(
    paperSurfaceNote(
      "Translucent tracing paper / drafting vellum · My pad",
      "printer",
    ),
  ).toBe("Printer paper · My pad");
});
