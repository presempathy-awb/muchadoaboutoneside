import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { FABRICATION_DOWNLOADS } from "./fabrication-downloads";

for (const [name, href] of Object.entries(FABRICATION_DOWNLOADS)) {
  test(`${name} download version matches the distributed file`, async () => {
    const url = new URL(href, "https://muchadoaboutoneside.com");
    const bytes = await Bun.file(
      resolve(import.meta.dir, `../public${url.pathname}`),
    ).arrayBuffer();
    const sha = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    expect(url.searchParams.get("v")).toBe(sha);
  });
}
