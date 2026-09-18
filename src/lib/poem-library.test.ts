import { describe, expect, test } from "bun:test";
import type { PoemId, SavedPoemId } from "../../shared/poem";
import { poemNameKey, type SavedPoemRecord } from "../../shared/poem-library";
import {
  browserPoemLibraryStorage,
  createPoemLibrary,
  type PoemLibraryStorage,
} from "./poem-library";

class TestStorage implements PoemLibraryStorage {
  records = new Map<string, SavedPoemRecord>();
  failure: Error | undefined;
  commitGate: Promise<void> | undefined;
  deletes: PoemId[] = [];
  tombstones = new Set<SavedPoemId>();
  async read() {
    if (this.failure) throw this.failure;
    return [...this.records.values()];
  }
  async save(record: SavedPoemRecord) {
    await this.commitGate;
    if (this.failure) throw this.failure;
    if (this.tombstones.has(record.id))
      throw new Error("Deleted version id cannot be restored.");
    if (
      this.records.has(record.id) ||
      [...this.records.values()].some(
        (existing) => poemNameKey(existing.name) === poemNameKey(record.name),
      )
    )
      throw new Error("That version name already exists.");
    this.records.set(record.id, structuredClone(record));
  }
  async delete(id: PoemId) {
    if (this.failure) throw this.failure;
    this.deletes.push(id);
    this.records.delete(id);
    this.tombstones.add(id as SavedPoemId);
  }
  async deleted() {
    return [...this.tombstones];
  }
}

const input = {
  name: "My reading",
  text: "First\n\nLast\n",
  baseId: "extended" as const,
};

describe("poem library persistence", () => {
  test("publishes and resolves a named copy only after durable storage completes", async () => {
    const storage = new TestStorage();
    let commit = () => {};
    storage.commitGate = new Promise<void>((resolve) => {
      commit = resolve;
    });
    let notifications = 0;
    const library = createPoemLibrary(storage, () => {
      notifications += 1;
    });
    await library.ready;
    let completed = false;
    const saving = library.saveVersion(input).then((saved) => {
      completed = true;
      return saved;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(completed).toBe(false);
    expect(notifications).toBe(0);
    expect(library.getSnapshot().versions.map((version) => version.id)).toEqual(
      ["canonical", "extended"],
    );
    commit();
    const saved = await saving;
    expect(notifications).toBe(1);
    expect(storage.records.get(saved.id)?.text).toBe(input.text);
    const reopened = createPoemLibrary(storage);
    await reopened.ready;
    expect(reopened.getSnapshot().versions[2]).toEqual(saved);
    expect(reopened.getSnapshot().versions[2]?.sourceText).toBe(input.text);
  });

  test("rejects failed commits without pretending an in-memory copy was saved", async () => {
    const storage = new TestStorage();
    const library = createPoemLibrary(storage);
    await library.ready;
    let commit = () => {};
    storage.commitGate = new Promise<void>((resolve) => {
      commit = resolve;
    });
    const saving = library.saveVersion(input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    storage.failure = new Error(
      "Browser storage is full. The version was not saved.",
    );
    commit();
    await expect(saving).rejects.toThrow("not saved");
    expect(library.getSnapshot().versions).toHaveLength(2);
    expect(library.getSnapshot().error).toContain("not saved");
    storage.failure = undefined;
    const saved = await library.saveVersion(input);
    expect(saved.label).toBe(input.name);
    expect(library.getSnapshot().error).toBeNull();
  });

  test("refreshes changes from another tab and preserves unique names across racing saves", async () => {
    const storage = new TestStorage();
    const first = createPoemLibrary(storage);
    const second = createPoemLibrary(storage);
    await Promise.all([first.ready, second.ready]);
    const result = await Promise.allSettled([
      first.saveVersion(input),
      second.saveVersion({ ...input, name: " MY READING " }),
    ]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(storage.records.size).toBe(1);
    await Promise.all([first.refresh(), second.refresh()]);
    expect(first.getSnapshot().versions).toEqual(second.getSnapshot().versions);
    const saved = first.getSnapshot().versions[2];
    if (!saved) throw new Error("Expected the saved copy.");
    await second.deleteVersion(saved.id);
    await first.refresh();
    expect(first.getSnapshot().versions.map((version) => version.id)).toEqual([
      "canonical",
      "extended",
    ]);
  });

  test("protects both originals before the storage layer receives a delete", async () => {
    const storage = new TestStorage();
    const library = createPoemLibrary(storage);
    await library.ready;
    await expect(library.deleteVersion("canonical")).rejects.toThrow(
      "cannot be deleted",
    );
    await expect(library.deleteVersion("extended")).rejects.toThrow(
      "cannot be deleted",
    );
    expect(storage.deletes).toEqual([]);
    await expect(
      browserPoemLibraryStorage().delete("canonical"),
    ).rejects.toThrow("cannot be deleted");
  });

  test("keeps originals usable and surfaces unavailable storage", async () => {
    const storage = new TestStorage();
    storage.failure = new Error("Browser storage is unavailable.");
    const library = createPoemLibrary(storage);
    await library.ready;
    expect(library.getSnapshot().ready).toBe(true);
    expect(library.getSnapshot().versions).toHaveLength(2);
    expect(library.getSnapshot().error).toContain("unavailable");
    await expect(library.saveVersion(input)).rejects.toThrow("unavailable");
  });

  test("deletion commits its tombstone before draft cleanup and retries explicit cleanup failures", async () => {
    const storage = new TestStorage();
    let failCleanup = true;
    const cleaned: PoemId[] = [];
    const library = createPoemLibrary(
      storage,
      () => {},
      async (id) => {
        expect(storage.records.has(id)).toBe(false);
        expect(storage.tombstones.has(id)).toBe(true);
        expect(
          library.getSnapshot().versions.some((version) => version.id === id),
        ).toBe(false);
        if (failCleanup)
          throw new Error("Another tab is blocking the draft database.");
        cleaned.push(id);
      },
    );
    await library.ready;
    const saved = await library.saveVersion(input);
    const oldRecord = storage.records.get(saved.id);
    if (!oldRecord) throw new Error("Missing test version.");
    await expect(library.deleteVersion(saved.id)).rejects.toThrow(
      "working draft could not be cleared",
    );
    expect(library.getSnapshot().error).toContain("Close other tabs");
    expect(library.getSnapshot().versions).toHaveLength(2);
    await expect(storage.save(oldRecord)).rejects.toThrow("cannot be restored");
    failCleanup = false;
    await library.refresh();
    expect(cleaned).toEqual([saved.id]);
    expect(library.getSnapshot().error).toBeNull();
    const reloadedCleanups: PoemId[] = [];
    const reloaded = createPoemLibrary(
      storage,
      () => {},
      async (id) => {
        reloadedCleanups.push(id);
      },
    );
    await reloaded.ready;
    expect(reloadedCleanups).toEqual([saved.id]);
    expect(reloaded.getSnapshot().versions).toHaveLength(2);
  });
});
