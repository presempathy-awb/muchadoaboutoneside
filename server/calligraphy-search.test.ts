import { expect, test } from "bun:test";
import { publicSourceUrl } from "./calligraphy-search";

test("citations reject executable, credentialed, local and numeric-address links", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,a",
    "https://localhost/x",
    "https://router.local/",
    "https://127.0.0.1/x",
    "https://2130706433/x",
    "https://[::1]/x",
    "https://user:pass@example.com/",
    "https://example.com:8080/",
    "http://example.com/",
  ])
    expect(publicSourceUrl(url)).toBeUndefined();
  expect(publicSourceUrl("https://www.calligraphr.com/en/features/")).toBe(
    "https://www.calligraphr.com/en/features/",
  );
});
