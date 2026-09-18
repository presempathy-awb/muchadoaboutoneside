import { describe, expect, test } from "bun:test";
import { browserGraphicsOptions, parseBrowserOptions } from "./browser-options";

describe("browser smoke scope", () => {
  test("defaults to a background isolated local browser", () => {
    expect(parseBrowserOptions([]).headless).toBe(true);
    expect(parseBrowserOptions([]).origin).toBeUndefined();
  });
  test("requires explicit opt-in for a visible browser", () => {
    expect(parseBrowserOptions(["--visible"]).headless).toBe(false);
    expect(parseBrowserOptions(["--headless"]).headless).toBe(true);
  });
  test("accepts the public project origin", () => {
    expect(
      parseBrowserOptions(["--origin", "https://muchadoaboutoneside.com"])
        .origin,
    ).toBe("https://muchadoaboutoneside.com");
  });
  test("normalizes the www redirect to the canonical public origin", () => {
    expect(
      parseBrowserOptions(["--origin", "https://www.muchadoaboutoneside.com"])
        .origin,
    ).toBe("https://muchadoaboutoneside.com");
  });
  test("rejects unrelated origins", () => {
    expect(() =>
      parseBrowserOptions(["--origin", "https://example.com"]),
    ).toThrow();
  });
  test("rejects credentials and non-root paths", () => {
    expect(() =>
      parseBrowserOptions(["--origin", "https://user@muchadoaboutoneside.com"]),
    ).toThrow();
    expect(() =>
      parseBrowserOptions([
        "--origin",
        "https://muchadoaboutoneside.com/private",
      ]),
    ).toThrow();
  });
  test("rejects unknown flags", () => {
    expect(() => parseBrowserOptions(["--profile", "personal"])).toThrow();
  });
});

describe("browser graphics scope", () => {
  test("requests Metal only for macOS headless tests", () => {
    expect(browserGraphicsOptions("darwin", true)).toEqual({
      flags: ["--enable-gpu", "--use-angle=metal"],
      requestedBackend: "angle-metal",
    });
  });
  test("keeps other browser driver selection unchanged", () => {
    expect(browserGraphicsOptions("darwin", false).flags).toEqual([]);
    expect(browserGraphicsOptions("linux", true).flags).toEqual([]);
  });
});
