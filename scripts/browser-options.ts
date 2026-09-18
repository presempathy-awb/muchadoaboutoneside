import { resolve } from "node:path";

export function parseBrowserOptions(args: string[]) {
  let headless = true;
  let origin: string | undefined;
  let output = resolve("artifacts/browser-smoke");
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--headless") headless = true;
    else if (flag === "--visible") headless = false;
    else if (flag === "--origin" || flag === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error(`${flag} needs a value`);
      if (flag === "--output") output = resolve(value);
      else {
        const url = new URL(value);
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(
          url.hostname,
        );
        const publicSite = [
          "muchadoaboutoneside.com",
          "www.muchadoaboutoneside.com",
        ].includes(url.hostname);
        if (
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash ||
          !(
            (local && ["http:", "https:"].includes(url.protocol)) ||
            (publicSite && url.protocol === "https:" && !url.port)
          )
        ) {
          throw new Error(
            "Browser smoke origin must be localhost or the project's HTTPS .com, without credentials or paths",
          );
        }
        origin =
          url.hostname === "www.muchadoaboutoneside.com"
            ? "https://muchadoaboutoneside.com"
            : url.origin;
      }
    } else throw new Error(`Unknown browser smoke option: ${flag}`);
  }
  return { headless, origin, output };
}

export function browserGraphicsOptions(platform: string, headless: boolean) {
  return platform === "darwin" && headless
    ? {
        flags: ["--enable-gpu", "--use-angle=metal"],
        requestedBackend: "angle-metal",
      }
    : { flags: [] as string[], requestedBackend: "browser-default" };
}
