import { describe, expect, test } from "bun:test";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import {
  disposeWorksheetTypography,
  loadWorksheetFont,
  validateWorksheetSfnt,
} from "./worksheet-fonts";
import type { WorksheetSnapshot } from "./worksheet-store";

function snapshot(
  fontId: WorksheetSnapshot["settings"]["fontId"],
): WorksheetSnapshot {
  return {
    version: 1,
    settings: { ...DEFAULT_WORKSHEET_SETTINGS, fontId },
    text: "Copperplate",
  };
}

async function embeddedSnapshot(
  overrides: Partial<WorksheetSnapshot["settings"]> = {},
): Promise<WorksheetSnapshot> {
  const bytes = new Uint8Array(
    await Bun.file("public/fonts/GreatVibes-Regular.ttf").arrayBuffer(),
  );
  return {
    version: 1,
    settings: {
      ...DEFAULT_WORKSHEET_SETTINGS,
      fontId: "custom",
      textEnabled: true,
      ...overrides,
    },
    text: "office e\u0301lan",
    customFont: {
      name: "Great Vibes test",
      dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
    },
  };
}

describe("worksheet fonts", () => {
  test("uses cached standard adapters and measures spacing in millimetres", async () => {
    const source = snapshot("sans");
    const first = await loadWorksheetFont(source);
    const second = await loadWorksheetFont(source);
    expect(second).toBe(first);
    expect(first.family).toBe("Arial, Helvetica, sans-serif");

    const base = first.measure("A B", source.settings);
    const spaced = first.measure("A B", {
      ...source.settings,
      letterSpacingMm: 1,
      wordSpacingMm: 2,
    });
    expect(spaced - base).toBeCloseTo(4, 8);

    const wide = first.measure("Copperplate", {
      ...source.settings,
      writingScale: 2,
    });
    expect(wide).toBeCloseTo(
      first.measure("Copperplate", source.settings) * 2,
      8,
    );
  });

  test("explains that a custom font omitted from an imported PDF must be reselected", async () => {
    await expect(loadWorksheetFont(snapshot("custom"))).rejects.toThrow(
      "Reselect the TTF or OTF font",
    );
  });

  test("uses the same selected engine for shaping, measurement, paths, and ink bounds", async () => {
    const fontkitSnapshot = await embeddedSnapshot({
      shapingEngine: "fontkit",
      fontFeatures: "liga=1,calt=1",
    });
    const harfbuzzSnapshot: WorksheetSnapshot = {
      ...fontkitSnapshot,
      settings: {
        ...fontkitSnapshot.settings,
        shapingEngine: "harfbuzz",
      },
    };
    const [fontkit, harfbuzz] = await Promise.all([
      loadWorksheetFont(fontkitSnapshot),
      loadWorksheetFont(harfbuzzSnapshot),
    ]);
    const fontkitRun = fontkit.shape(
      fontkitSnapshot.text,
      fontkitSnapshot.settings,
    );
    const harfbuzzRun = harfbuzz.shape(
      harfbuzzSnapshot.text,
      harfbuzzSnapshot.settings,
    );

    expect(fontkitRun.engine).toBe("fontkit");
    expect(harfbuzzRun.engine).toBe("harfbuzz");
    expect(fontkitRun.glyphs.map(({ id }) => id)).toEqual(
      fontkit
        .shape(fontkitSnapshot.text, fontkitSnapshot.settings)
        .glyphs.map(({ id }) => id),
    );
    expect(harfbuzzRun.glyphs.map(({ id }) => id)).toEqual(
      harfbuzz
        .shape(harfbuzzSnapshot.text, harfbuzzSnapshot.settings)
        .glyphs.map(({ id }) => id),
    );
    expect(
      fontkitRun.glyphs.filter(({ path }) => Boolean(path)).length,
    ).toBeGreaterThan(0);
    expect(
      harfbuzzRun.glyphs.filter(({ path }) => Boolean(path)).length,
    ).toBeGreaterThan(0);
    expect(fontkitRun.inkBoundsMm?.width).toBeGreaterThan(0);
    expect(harfbuzzRun.inkBoundsMm?.height).toBeGreaterThan(0);
    expect(
      fontkit.measure(fontkitSnapshot.text, fontkitSnapshot.settings),
    ).toBe(fontkitRun.widthMm);
    expect(
      harfbuzz.measure(harfbuzzSnapshot.text, harfbuzzSnapshot.settings),
    ).toBe(harfbuzzRun.widthMm);
    expect(harfbuzzRun.widthMm).toBeCloseTo(fontkitRun.widthMm, 4);
  });

  test("derives the point size from the font's physical lowercase height", async () => {
    const source = await embeddedSnapshot({
      fontSizeMode: "xheight",
      textXHeightMm: 5,
    });
    const font = await loadWorksheetFont(source);
    const expected = ((5 * 72) / 25.4) * (font.unitsPerEm / font.xHeightUnits);
    expect(font.resolveSizePt(source.settings)).toBeCloseTo(expected, 10);
    expect(font.shape("x", source.settings).sizePt).toBeCloseTo(expected, 10);
  });

  test("shapes bounded vector runs with every bundled calligraphy font file", async () => {
    const files = [
      "GreatVibes-Regular.ttf",
      "PinyonScript-Regular.ttf",
      "ImperialScript-Regular.ttf",
      "Italianno-Regular.ttf",
      "HerrVonMuellerhoff-Regular.ttf",
      "MrsSaintDelafield-Regular.ttf",
    ];
    for (const file of files) {
      const bytes = new Uint8Array(
        await Bun.file(`public/fonts/${file}`).arrayBuffer(),
      );
      const source: WorksheetSnapshot = {
        version: 1,
        settings: {
          ...DEFAULT_WORKSHEET_SETTINGS,
          fontId: "custom",
          textEnabled: true,
        },
        text: "A flourish flows",
        customFont: {
          name: file,
          dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
        },
      };
      const font = await loadWorksheetFont(source);
      const run = font.shape(source.text, source.settings);
      expect(run.widthMm, file).toBeGreaterThan(0);
      expect(run.inkBoundsMm?.height, file).toBeGreaterThan(0);
      expect(
        run.glyphs.some(({ path }) => Boolean(path)),
        file,
      ).toBe(true);
    }
  });

  test("rejects unavailable features and bounds custom font input before decoding", async () => {
    const source = await embeddedSnapshot({ fontFeatures: "swsh=1" });
    const font = await loadWorksheetFont(source);
    expect(() => font.shape(source.text, source.settings)).toThrow(
      "does not support",
    );

    const tooLarge: WorksheetSnapshot = {
      ...source,
      customFont: {
        name: "Oversized",
        dataUrl: `data:font/ttf;base64,${"A".repeat(2_800_000)}`,
      },
    };
    await expect(loadWorksheetFont(tooLarge)).rejects.toThrow("2 MB");
    expect(() =>
      validateWorksheetSfnt(new Uint8Array([0, 1, 0, 0, 0, 200])),
    ).toThrow(/too short|table directory/);
  });

  test("explicit disposal releases cached shapers and permits a clean reload", async () => {
    const source = await embeddedSnapshot();
    const first = await loadWorksheetFont(source);
    expect(first.measure("Practice", source.settings)).toBeGreaterThan(0);
    await disposeWorksheetTypography();
    expect(() => first.measure("New run", source.settings)).toThrow("disposed");
    const second = await loadWorksheetFont(source);
    expect(second).not.toBe(first);
    expect(second.measure("Practice", source.settings)).toBeGreaterThan(0);
  });

  test("font-cache eviction never invalidates a font still held by the preview", async () => {
    await disposeWorksheetTypography();
    const original = new Uint8Array(
      await Bun.file("public/fonts/GreatVibes-Regular.ttf").arrayBuffer(),
    );
    let first: Awaited<ReturnType<typeof loadWorksheetFont>> | undefined;
    let firstSettings: WorksheetSnapshot["settings"] | undefined;
    for (let index = 0; index < 17; index += 1) {
      const bytes = new Uint8Array(original.length + 1);
      bytes.set(original);
      bytes[bytes.length - 1] = index;
      const source: WorksheetSnapshot = {
        version: 1,
        settings: {
          ...DEFAULT_WORKSHEET_SETTINGS,
          fontId: "custom",
          textEnabled: true,
        },
        text: "Still live",
        customFont: {
          name: `Eviction ${index}`,
          dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
        },
      };
      const loaded = await loadWorksheetFont(source);
      if (index === 0) {
        first = loaded;
        firstSettings = source.settings;
      }
    }
    expect(first).toBeDefined();
    expect(firstSettings).toBeDefined();
    if (!first || !firstSettings) throw new Error("Expected the first font.");
    expect(first.measure("Still live", firstSettings)).toBeGreaterThan(0);
  });
});
