import { expect, test } from "bun:test";
import { formatInches } from "./project-query";

test("feet and inches retain measured tenths and carry at foot boundaries", () => {
  expect(formatInches(206.3)).toBe("17′ 2.3″");
  expect(formatInches(171)).toBe("14′ 3″");
  expect(formatInches(11.96)).toBe("1′ 0″");
  expect(formatInches(0)).toBe("0′ 0″");
});
