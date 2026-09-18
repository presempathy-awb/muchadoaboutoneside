import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import {
  installResetGenerationGuard,
  mergeAndCompactWorksheetUpdates,
  mergeStoredWorksheetUpdates,
  parseWorksheetSnapshot,
  recoverWorksheetUpdateWithoutInvalidAssets,
  serializeWorksheetSnapshot,
  validateStoredWorksheetUpdate,
  type WorksheetSnapshot,
  worksheetAssetReferences,
  worksheetBackgroundReadsHealthy,
  worksheetSnapshotFromState,
} from "./worksheet-store";

const snapshot: WorksheetSnapshot = {
  version: 1,
  settings: DEFAULT_WORKSHEET_SETTINGS,
  text: "A line to practise",
  photo: {
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    pixelWidth: 1200,
    pixelHeight: 800,
    widthMm: 100,
    xMm: 5,
    yMm: 8,
    opacity: 0.4,
    rotation: 0,
    print: false,
  },
  customFont: {
    name: "My hand",
    dataUrl: "data:font/ttf;base64,AAECAw==",
  },
};

describe("worksheet backup format", () => {
  test("returns a safe default snapshot before browser hydration", () => {
    expect(worksheetSnapshotFromState({})).toEqual({
      version: 1,
      settings: DEFAULT_WORKSHEET_SETTINGS,
      text: "",
    });
  });

  test("round trips its versioned local data", () => {
    expect(
      parseWorksheetSnapshot(serializeWorksheetSnapshot(snapshot)),
    ).toEqual(snapshot);
  });

  test("keeps selected fonts, shaping, physical height and practice rows in backups", () => {
    const configured: WorksheetSnapshot = {
      ...snapshot,
      settings: {
        ...snapshot.settings,
        fontId: "italianno",
        shapingEngine: "harfbuzz",
        fontSizeMode: "xheight",
        textXHeightMm: 4.5,
        fontFeatures: "liga=0,ss01=1",
        practicePattern: "model-trace-blank",
      },
    };
    expect(
      parseWorksheetSnapshot(serializeWorksheetSnapshot(configured)),
    ).toEqual(configured);
  });

  test("imports an older backup without losing its lettering settings", () => {
    const restored = parseWorksheetSnapshot({
      version: 1,
      settings: { fontId: "great-vibes", fontSizePt: 36, lineCount: 18 },
      text: "Keep my earlier draft",
    });
    expect(restored.settings).toMatchObject({
      fontSizePt: 36,
      lineCount: 18,
      fontSizeMode: "points",
      shapingEngine: "fontkit",
      practicePattern: "continuous",
    });
    expect(restored.text).toBe("Keep my earlier draft");
  });

  test("rejects future versions with a useful message", () => {
    expect(() => parseWorksheetSnapshot({ ...snapshot, version: 2 })).toThrow(
      "newer version",
    );
  });

  test("rejects unknown top-level fields instead of silently changing format", () => {
    expect(() =>
      parseWorksheetSnapshot({ ...snapshot, remoteUrl: "https://example.com" }),
    ).toThrow("unsupported");
  });

  test("rejects remote and executable asset URLs", () => {
    expect(() =>
      parseWorksheetSnapshot({
        ...snapshot,
        photo: { ...snapshot.photo, dataUrl: "https://example.com/photo.png" },
      }),
    ).toThrow("embedded base64");
    expect(() =>
      parseWorksheetSnapshot({
        ...snapshot,
        customFont: { name: "Bad", dataUrl: "data:text/html;base64,PGgxPg==" },
      }),
    ).toThrow("embedded base64");
  });

  test("bounds text and imported metadata", () => {
    expect(() =>
      parseWorksheetSnapshot({ ...snapshot, text: "x".repeat(20_001) }),
    ).toThrow("20,000");
    expect(() =>
      parseWorksheetSnapshot({
        ...snapshot,
        photo: { ...snapshot.photo, opacity: 2 },
      }),
    ).toThrow("Photo opacity");
  });

  test("caps each embedded asset so two-tab asset merges remain under 8 MB", () => {
    expect(() =>
      parseWorksheetSnapshot({
        ...snapshot,
        photo: {
          ...snapshot.photo,
          dataUrl: `data:image/png;base64,${"A".repeat(3 * 1024 * 1024)}`,
        },
      }),
    ).toThrow("smaller than 3 MB");
  });

  test("can retain valid text and settings while omitting a bad optional asset", () => {
    expect(
      worksheetSnapshotFromState({
        settings: { ...DEFAULT_WORKSHEET_SETTINGS, lineCount: 18 },
        text: "Keep this wording",
      }),
    ).toMatchObject({
      text: "Keep this wording",
      settings: { lineCount: 18 },
    });
  });

  test("rejects writing proportions that cannot fit on the paper", () => {
    expect(() =>
      parseWorksheetSnapshot({
        ...snapshot,
        settings: {
          ...DEFAULT_WORKSHEET_SETTINGS,
          paper: "a5",
          orientation: "landscape",
          mode: "copperplate",
          xHeightMm: 50,
          ascenderRatio: 5,
          descenderRatio: 5,
        },
      }),
    ).toThrow("writing proportions do not fit");
  });
});

describe("worksheet persistence updates", () => {
  test("asset recovery cannot clear an outstanding template refresh failure", () => {
    let templateReadFailed = true;
    let assetReadFailed = true;
    expect(
      worksheetBackgroundReadsHealthy(templateReadFailed, assetReadFailed),
    ).toBe(false);

    assetReadFailed = false;

    expect(
      worksheetBackgroundReadsHealthy(templateReadFailed, assetReadFailed),
    ).toBe(false);
    templateReadFailed = false;
    expect(
      worksheetBackgroundReadsHealthy(templateReadFailed, assetReadFailed),
    ).toBe(true);
  });

  test("merges simultaneous tab updates instead of overwriting either tab", () => {
    const first = new Y.Doc();
    const second = new Y.Doc();
    first.getMap("worksheet").set("left", "kept");
    second.getMap("worksheet").set("right", "kept");

    const merged = mergeStoredWorksheetUpdates(
      Y.encodeStateAsUpdate(first),
      Y.encodeStateAsUpdate(second),
    );
    const restored = new Y.Doc();
    Y.applyUpdate(restored, merged);

    expect(restored.getMap("worksheet").toJSON()).toEqual({
      left: "kept",
      right: "kept",
    });
    first.destroy();
    second.destroy();
    restored.destroy();
  });

  test("rejects a concurrent merge that exceeds the text limit", () => {
    const first = new Y.Doc();
    const second = new Y.Doc();
    first.getText("practice-text").insert(0, "a".repeat(12_000));
    second.getText("practice-text").insert(0, "b".repeat(12_000));

    expect(() =>
      mergeAndCompactWorksheetUpdates(
        Y.encodeStateAsUpdate(first),
        Y.encodeStateAsUpdate(second),
      ),
    ).toThrow("20,000");
    first.destroy();
    second.destroy();
  });

  test("compacts superseded embedded photo history out of the main document", () => {
    const doc = new Y.Doc();
    const root = doc.getMap("worksheet");
    root.set("photo", {
      ...snapshot.photo,
      dataUrl: `data:image/png;base64,${"A".repeat(100_000)}`,
    });
    const stored = Y.encodeStateAsUpdate(doc);
    let metadataUpdate: Uint8Array | undefined;
    doc.on("update", (update) => {
      metadataUpdate = update;
    });
    root.set("photo", {
      assetId: "photo-separate-asset",
      pixelWidth: 1200,
      pixelHeight: 800,
      widthMm: 100,
      xMm: 5,
      yMm: 8,
      opacity: 0.4,
      rotation: 0,
      print: false,
    });

    const compacted = mergeAndCompactWorksheetUpdates(
      stored,
      metadataUpdate as Uint8Array,
    );

    expect(compacted.byteLength).toBeLessThan(stored.byteLength / 10);
    expect(worksheetAssetReferences(compacted)).toEqual([
      { id: "photo-separate-asset", kind: "photo" },
    ]);
    doc.destroy();
  });

  test("rejects a structurally valid Yjs update with invalid worksheet data", () => {
    const corrupt = new Y.Doc();
    corrupt.getMap("worksheet").set("settings", "not settings");
    expect(() =>
      validateStoredWorksheetUpdate(Y.encodeStateAsUpdate(corrupt)),
    ).toThrow("Worksheet settings must be an object");
    corrupt.destroy();
  });

  test("recovers text and settings while omitting only a corrupt optional asset", () => {
    const damaged = new Y.Doc();
    damaged
      .getMap("worksheet")
      .set("settings", { ...DEFAULT_WORKSHEET_SETTINGS, lineCount: 17 });
    damaged.getMap("worksheet").set("photo", {
      ...snapshot.photo,
      dataUrl: "data:text/html;base64,PGgxPg==",
    });
    damaged.getText("practice-text").insert(0, "Preserve these words");

    const recovered = recoverWorksheetUpdateWithoutInvalidAssets(
      Y.encodeStateAsUpdate(damaged),
    );
    const restored = new Y.Doc();
    Y.applyUpdate(restored, recovered.update);

    expect(recovered.omitted).toEqual(["photo"]);
    expect(restored.getText("practice-text").toString()).toBe(
      "Preserve these words",
    );
    expect(restored.getMap("worksheet").get("photo")).toBeUndefined();
    expect(
      (restored.getMap("worksheet").get("settings") as { lineCount: number })
        .lineCount,
    ).toBe(17);
    damaged.destroy();
    restored.destroy();
  });

  test("clears local undo history when another load generation arrives", () => {
    const doc = new Y.Doc();
    const text = doc.getText("practice-text");
    const root = doc.getMap("worksheet");
    const undo = new Y.UndoManager(text);
    installResetGenerationGuard(root, undo);
    text.insert(0, "old local wording");
    expect(undo.canUndo()).toBe(true);

    root.set("resetGeneration", "load-from-another-tab");

    expect(undo.canUndo()).toBe(false);
    undo.destroy();
    doc.destroy();
  });
});
