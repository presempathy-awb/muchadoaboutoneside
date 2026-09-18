# Repeatable browser checks

Build the production app, then run `bun run test:browser`. Chrome runs headlessly in the background by default using a new temporary profile, with no saved accounts or personal tabs. An explicit `--visible` opt-in opens a test window. The script sends no page-foreground or application-activation commands; an explicitly requested visible window may still be presented by the operating system. The script sends background Chrome DevTools Protocol commands; it does not move the pointer. It stops its browser and local server and removes the profile when finished. An unresponsive owned browser receives SIGTERM, then SIGKILL after a bounded wait; unrelated browser processes are never signaled.

Visible checks use device scale factor 2; headless checks use 1 to reduce framebuffer pressure on software-rendered CI. The selected factor is recorded in `results.json`. This affects only the test browser.

Use `bun run test:browser` for background checks (`--headless` remains supported), or `bun run test:browser --origin https://muchadoaboutoneside.com` for the deployed site. Only localhost and the project HTTPS domains are accepted. Test edits remain in the temporary browser's local storage; no account login, cloud save, or publication occurs.

`--output /absolute/path` chooses the directory for PNG screenshots, `results.json`, `diagnostics.json`, and the isolated browser’s `browser-stderr.log` (default `artifacts/browser-smoke`). Screenshots are review artifacts and are not uploaded. `BROWSER_SMOKE_CHROME` may select an installed Chrome/Chromium executable; no browser or npm package is downloaded.

The checks cover homepage scale controls, a rendered lettering proof, resizing and anonymous reload durability, a bounded size search on a small synthetic maquette, an actual font redraw, proof zoom and its 8 million pixel budget, mobile page overflow, the preserved foil edition, contrast failure and recovery, intentionally blank saved wording, and app JavaScript exceptions. Timeouts fail rather than silently skipping an unavailable browser or renderer. Shape regression covers outline selection, actual changed geometry, aspect, corner cut, taper, physical depth, reload persistence, and a reference reset that preserves other design fields. The archival photo preset also retains wording and displays body bounds excluding the base. These checks use synthetic wording and the same headless isolation. A passing DOM smoke test does not prove human legibility or manufacturing correctness; inspect screenshots and the studio's measured visibility checks separately.

The public GitHub workflow runs the headless checks after building, using Chrome
provided by its Ubuntu runner image. On other runners, install Chrome in the image,
build first, then run `bun run test:browser --headless --output artifacts/browser-smoke`.
The existing HTTP smoke remains useful for assets and routes without a browser.

Protocol reference: [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/), including Runtime evaluation and exceptions, Page screenshots/navigation, and Emulation viewport metrics.

On macOS, background headless tests request the native ANGLE Metal backend with `--enable-gpu --use-angle=metal` after repeated software-headless stalls. Other platforms retain Chrome's default driver selection. `results.json` records the requested backend; it is not a claim that Chrome successfully selected it. These test flags do not change the product or activate a window. See [Chromium headless driver selection](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/headless/headless_mode_switches.h) and [ANGLE backend options](https://github.com/google/angle/blob/main/doc/DebuggingTips.md).

The isolated test browser disables background timer throttling, renderer backgrounding, and occluded-window backgrounding. These are also [Playwright's Chromium automation defaults](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts). They keep bounded asynchronous fit work progressing without bringing any window forward; production browser behavior is unchanged.
