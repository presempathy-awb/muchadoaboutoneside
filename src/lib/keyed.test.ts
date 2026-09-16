import { expect, test } from "bun:test";
import { keyed } from "./keyed";

test("repeated text gets distinct, stable keys", () => {
  const items = ["twine", "twine", "mine", "twine"];
  const keys = keyed(items).map((entry) => entry.key);
  expect(new Set(keys).size).toBe(items.length);
  expect(keyed(items).map((entry) => entry.item)).toEqual(items);
  expect(keyed(items)).toEqual(keyed(items));
  expect(keyed([])).toEqual([]);
});
