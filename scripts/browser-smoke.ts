import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../server/app";
import { DEFAULT_SCALE_DESIGN } from "../shared/scale-design";
import { applyScaleVersionPreset } from "../shared/scale-versions";
import { browserGraphicsOptions, parseBrowserOptions } from "./browser-options";

const options = parseBrowserOptions(Bun.argv.slice(2));
const deviceScaleFactor = options.headless ? 1 : 2;
const graphics = browserGraphicsOptions(process.platform, options.headless);
const profile = await mkdtemp(join(tmpdir(), "muchado-browser-"));
const errors: string[] = [];
const results: { name: string; passed: boolean; detail?: unknown }[] = [];
let app: ReturnType<typeof createApp> | undefined;
let browser: ReturnType<typeof Bun.spawn> | undefined;
let stderrFd: number | undefined;
let socket: WebSocket | undefined;
const pending = new Map<
  number,
  {
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
let requestId = 0;

function request(
  method: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      },
      method === "Runtime.evaluate" ? 30000 : 15000,
    );
    pending.set(id, { resolve, reject, timer });
    socket?.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate<T>(expression: string): Promise<T> {
  const response = await request("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails)
    throw new Error(JSON.stringify(response.exceptionDetails));
  return (response.result as { value: T }).value;
}
async function waitFor<T>(
  name: string,
  check: () => Promise<T>,
  timeout = 90000,
): Promise<T> {
  console.log(`WAIT ${name}`);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await Bun.sleep(200);
  }
  throw new Error(`Timed out waiting for ${name}`);
}
async function assert(name: string, expression: string) {
  const detail = await evaluate(expression);
  results.push({ name, passed: Boolean(detail), detail });
  if (!detail) throw new Error(`Browser assertion failed: ${name}`);
  console.log(`PASS ${name}`);
}
async function screenshot(name: string) {
  const image = await request("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await Bun.write(
    join(options.output, `${name}.png`),
    Buffer.from(image.data as string, "base64"),
  );
}
async function replaceDocument(
  name: string,
  method: string,
  params: Record<string, unknown>,
  ready: string,
) {
  const token = crypto.randomUUID();
  await evaluate(`window.__browserSmokeDocument = ${JSON.stringify(token)}`);
  await request(method, params);
  await waitFor(name, async () => {
    try {
      return await evaluate<boolean>(
        `window.__browserSmokeDocument !== ${JSON.stringify(token)} && (${ready})`,
      );
    } catch (error) {
      if (
        /Execution context was destroyed|Cannot find context|Inspected target navigated|Cannot find default execution context/i.test(
          String(error),
        )
      )
        return false;
      throw error;
    }
  });
}
async function navigate(path: string, ready: string) {
  await replaceDocument(
    path,
    "Page.navigate",
    { url: `${origin}${path}` },
    ready,
  );
}
async function reload(ready: string) {
  await replaceDocument("new document after reload", "Page.reload", {}, ready);
}
let origin = options.origin ?? "";
let failure: unknown;
const diagnostics: { stage: string; data: unknown }[] = [];
async function diagnose(stage: string) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  try {
    const data = await evaluate(
      `(() => { const w=document.querySelector('[data-testid="scales-workbench"]'); const ink=document.querySelector('#scales-ink'); const paper=document.querySelector('#scales-metal'); return { url:location.href, workbench:w ? Object.fromEntries(Array.from(w.attributes).filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])) : null, ink:ink?.value, paper:paper?.value, inkVisible:Boolean(ink?.getClientRects().length), activeElement:document.activeElement?.id, draft:localStorage.getItem('muchado.scale-study.v1'), visibility:document.querySelector('[data-testid="scales-visibility"]')?.outerHTML, fitMessages:Array.from(document.querySelectorAll('.scales-size-card [role="status"]')).map(e=>e.textContent), alerts:Array.from(document.querySelectorAll('[role="alert"],.scales-error')).map(e=>e.textContent) }; })()`,
    );
    diagnostics.push({ stage, data });
    await Bun.write(
      join(options.output, "diagnostics.json"),
      JSON.stringify(diagnostics, null, 2),
    );
  } catch (error) {
    diagnostics.push({ stage, data: String(error) });
  }
}
try {
  await mkdir(options.output, { recursive: true });
  if (!origin) {
    if (
      !(await Bun.file(resolve(import.meta.dir, "../dist/index.html")).exists())
    )
      throw new Error("Build first: bun run build");
    app = createApp({ staticDir: resolve(import.meta.dir, "../dist") }).listen({
      hostname: "127.0.0.1",
      port: 0,
    });
    if (!app.server) throw new Error("Browser smoke server failed to start");
    origin = `http://127.0.0.1:${app.server.port}`;
  }
  const candidates = [
    process.env.BROWSER_SMOKE_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value));
  let executable: string | undefined;
  for (const candidate of candidates)
    if (await Bun.file(candidate).exists()) {
      executable = candidate;
      break;
    }
  if (!executable)
    throw new Error(
      "Chrome/Chromium missing; set BROWSER_SMOKE_CHROME to its executable",
    );
  console.log(
    `Starting ${options.headless ? "background headless" : "opt-in visible"} Chrome with a fresh temporary profile. CDP commands run in the background; no personal accounts or tabs are used.`,
  );
  stderrFd = openSync(join(options.output, "browser-stderr.log"), "w", 0o600);
  browser = Bun.spawn(
    [
      executable,
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--window-size=1440,1000",
      ...(options.headless ? ["--headless=new"] : []),
      ...graphics.flags,
      "about:blank",
    ],
    { stdout: "ignore", stderr: stderrFd },
  );
  const activePort = await waitFor(
    "Chrome debugging endpoint",
    async () => {
      try {
        return (
          await readFile(join(profile, "DevToolsActivePort"), "utf8")
        ).split("\n")[0];
      } catch {
        return undefined;
      }
    },
    20000,
  );
  const tabs = (await fetch(`http://127.0.0.1:${activePort}/json/list`, {
    signal: AbortSignal.timeout(10000),
  }).then((response) => response.json())) as {
    type: string;
    webSocketDebuggerUrl: string;
  }[];
  const tab = tabs.find((tab) => tab.type === "page");
  if (!tab) throw new Error("No isolated Chrome page target");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  socket.addEventListener("close", () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Chrome closed its debugging connection"));
    }
    pending.clear();
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result ?? {});
    } else if (message.method === "Runtime.exceptionThrown")
      errors.push(JSON.stringify(message.params.exceptionDetails));
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CDP connection timeout")),
      10000,
    );
    socket?.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket?.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("CDP socket failed"));
      },
      { once: true },
    );
  });
  await request("Runtime.enable");
  await request("Page.enable");
  await request("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor,
    mobile: false,
  });
  const syntheticDesign = {
    ...applyScaleVersionPreset(DEFAULT_SCALE_DESIGN, "maquette-180"),
    text: "Silence sings softly.",
    fontSizeMm: 6,
    minFontSizeMm: 6,
    autoFit: false,
    calligraphyFaceId: "font",
  };
  await request("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.origin === ${JSON.stringify(origin)} && !localStorage.getItem('muchado.scale-study.v1')) localStorage.setItem('muchado.scale-study.v1', ${JSON.stringify(JSON.stringify(syntheticDesign))});`,
  });
  await navigate(
    "/",
    `Boolean(document.querySelector('#scales-height') && document.querySelector('canvas[aria-label]'))`,
  );
  await waitFor("committed scale preview", () =>
    evaluate<boolean>(
      `document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-preview-ready') === 'true'`,
    ),
  );
  await assert(
    "homepage contains the scale resizer",
    `Boolean(document.querySelector('#scales-height') && document.querySelector('#scales-font'))`,
  );
  await waitFor("scale proof", () =>
    evaluate<boolean>(
      `Boolean(document.querySelector('canvas[aria-label^="Lettering proof"]'))`,
    ),
  );
  await assert(
    "proof canvas has a backing resolution",
    `Array.from(document.querySelectorAll('canvas')).some(c => c.getAttribute('aria-label')?.startsWith('Lettering proof') && c.width > 0 && c.height > 0)`,
  );
  await assert(
    "proof contains drawn pixels",
    `(() => { const c = document.querySelector('canvas[aria-label^="Lettering proof"]'); const pixels = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let drawn=0; for(let i=3;i<pixels.length;i+=4) if(pixels[i] > 0) drawn++; return drawn > 100 && drawn < c.width*c.height; })()`,
  );
  await evaluate(
    `document.querySelector('.scale-proof-viewport').scrollIntoView({block:'center'})`,
  );
  await assert(
    "deterministic visibility report is available",
    `Boolean(document.querySelector('[data-testid="scales-visibility"]'))`,
  );
  await assert(
    "fit search action is available",
    `Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Enlarge until the words fit')`,
  );
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === '200%').click()`,
  );
  await waitFor("proof zoom", () =>
    evaluate<boolean>(
      `Array.from(document.querySelectorAll('.scale-proof-tools button')).some(b => b.textContent === '200%' && b.getAttribute('aria-pressed') === 'true')`,
    ),
  );
  await assert(
    "zoomed proof stays within its pixel budget",
    `(() => { const c = document.querySelector('canvas[aria-label^="Lettering proof"]'); return c.width * c.height <= 8000000 && parseFloat(c.style.width) === 3200; })()`,
  );
  const centeredProof = `(() => { const v=document.querySelector('.scale-proof-viewport'); return v && Math.abs(v.scrollLeft-Math.max(0,(v.scrollWidth-v.clientWidth)/2))<=1 && Math.abs(v.scrollTop-Math.max(0,(v.scrollHeight-v.clientHeight)/2))<=1; })()`;
  await waitFor("zoomed proof centers after animation frame", () =>
    evaluate<boolean>(centeredProof),
  );
  await assert("200% proof centers on its face", centeredProof);
  await screenshot("proof-zoom");
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === 'Expand proof').click()`,
  );
  await waitFor("native proof dialog opens", () =>
    evaluate<boolean>(
      `Boolean(document.querySelector('.scale-proof-dialog[open] canvas'))`,
    ),
  );
  await assert(
    "expanded proof stays within pixel budget",
    `(() => { const c=document.querySelector('.scale-proof-dialog[open] canvas'); return c && c.width > 0 && c.height > 0 && c.width*c.height <= 8000000; })()`,
  );
  await waitFor("expanded zoom centers after animation frame", () =>
    evaluate<boolean>(centeredProof),
  );
  await assert("expanded 200% proof centers on its face", centeredProof);
  await screenshot("proof-expanded");
  await request("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await request("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await waitFor("Escape closes proof dialog", () =>
    evaluate<boolean>(
      `!document.querySelector('.scale-proof-dialog[open]') && Boolean(document.querySelector('.scale-proof-viewport canvas'))`,
    ),
  );
  await waitFor("proof expansion button regains focus", () =>
    evaluate<boolean>(
      `document.activeElement?.textContent.trim() === 'Expand proof'`,
    ),
  );
  await assert(
    "proof dialog closes with Escape",
    `!document.querySelector('.scale-proof-dialog[open]')`,
  );

  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === 'Fit').click()`,
  );
  await waitFor("Fit proof resets its scroll position", () =>
    evaluate<boolean>(
      `(() => { const v=document.querySelector('.scale-proof-viewport'); const c=v?.querySelector('canvas'); return c && c.style.width !== '3200px' && v.scrollLeft === 0 && (v.scrollHeight > v.clientHeight || v.scrollTop === 0); })()`,
    ),
  );
  await evaluate(
    `document.querySelector('[data-testid="scales-workbench"]').scrollIntoView({block:'start'})`,
  );
  await screenshot("home-desktop");
  const previousStored = await evaluate<string>(
    `localStorage.getItem('muchado.scale-study.v1')`,
  );
  const height = await evaluate<string>(
    `(() => { const input = document.querySelector('#scales-height'); input.focus(); const value = String(Number(input.value) * 1.03); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); return value; })()`,
  );
  await waitFor("height draft updates", () =>
    evaluate<boolean>(
      `document.querySelector('#scales-height').value === ${JSON.stringify(height)}`,
    ),
  );
  await evaluate(`document.querySelector('#scales-height').focus()`);
  await assert(
    "height field owns Enter focus",
    `document.activeElement?.id === 'scales-height'`,
  );
  await request("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await request("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await waitFor("resized preview commits", () =>
    evaluate<boolean>(
      `(() => { const workbench = document.querySelector('[data-testid="scales-workbench"]'); return workbench?.getAttribute('data-preview-ready') === 'true' && Number(workbench.getAttribute('data-model-scale')) > 1.02; })()`,
    ),
  );
  await waitFor("resize stored", () =>
    evaluate<boolean>(
      `(() => { const stored = localStorage.getItem('muchado.scale-study.v1'); return stored && stored !== ${JSON.stringify(previousStored)}; })()`,
    ),
  );
  const stored = await evaluate<string>(
    `localStorage.getItem('muchado.scale-study.v1')`,
  );
  await reload(`Boolean(document.querySelector('#scales-height'))`);
  await assert(
    "resize survives a reload",
    `localStorage.getItem('muchado.scale-study.v1') === ${JSON.stringify(stored)} && Math.abs(Number(document.querySelector('#scales-height')?.value) - Number(${JSON.stringify(height)})) < 0.2`,
  );
  await waitFor("reloaded committed preview", () =>
    evaluate<boolean>(
      `document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-preview-ready') === 'true'`,
    ),
  );
  await assert(
    "font choices are available",
    `document.querySelector('#scales-font').options.length > 2`,
  );
  // Pause offscreen 3D rendering before the real geometry-worker size search.
  // CPU-only CI browsers otherwise spend the search's bounded time rendering
  // the overview while the worker and yielded allocator need that same CPU.
  await evaluate(
    `document.querySelector('.scales-proof-card').scrollIntoView({block:'start'})`,
  );
  await waitFor("overview canvas leaves the viewport before fit", () =>
    evaluate<boolean>(
      `(() => { const c=document.querySelector('.scales-model-card canvas'); if(!c) return false; const r=c.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth; })()`,
    ),
  );
  await evaluate(
    `new Promise(resolve => setTimeout(() => setTimeout(resolve, 0), 0))`,
  );
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Enlarge until the words fit').click()`,
  );
  await waitFor(
    "bounded size search completes",
    () =>
      evaluate<boolean>(
        `Boolean(document.querySelector('[data-testid="scales-workbench"]')) && ['fit','limit','error','cancelled'].includes(document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-fit-state'))`,
      ),
    120000,
  );
  const fitDiagnostic = await evaluate(
    `({ state:document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-fit-state'), previewReady:document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-preview-ready'), visibilityState:document.visibilityState, messages:Array.from(document.querySelectorAll('.scales-size-card [role="status"]')).map(e=>e.textContent?.trim()) })`,
  );
  console.log(`FIT ${JSON.stringify(fitDiagnostic)}`);
  await diagnose("size search terminal state");
  await assert(
    "bounded size search finds a fit",
    `document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-fit-state') === 'fit'`,
  );
  await waitFor("fitted preview commits", () =>
    evaluate<boolean>(
      `document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-preview-ready') === 'true'`,
    ),
  );
  await assert(
    "size search enlarges the small synthetic study",
    `Number(document.querySelector('[data-testid="scales-workbench"]').getAttribute('data-model-scale')) > 1.03`,
  );
  await assert(
    "fit preserves requested lettering size",
    `JSON.parse(localStorage.getItem('muchado.scale-study.v1')).fontSizeMm === 6`,
  );
  await screenshot("fitted-preview");
  await waitFor("lettered proof after fit", () =>
    evaluate<boolean>(
      `/Silence|sings|softly/.test(document.querySelector('canvas[aria-label^="Lettering proof"]')?.getAttribute('aria-label') ?? '')`,
    ),
  );
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === 'Fit').click(); document.querySelector('.scale-proof-viewport').scrollIntoView({block:'center'})`,
  );
  const inkPixels = `(() => { const c=document.querySelector('canvas[aria-label^="Lettering proof"]'); if(!c) return false; const color=document.querySelector('#scales-ink').value; const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)); const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let count=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i+3]>128 && rgb.every((v,j)=>Math.abs(pixels[i+j]-v)<=12)) count++; return count>5 ? count : false; })()`;
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === '100%').click()`,
  );
  await waitFor("100% fitted proof centers", () =>
    evaluate<boolean>(
      `parseFloat(document.querySelector('canvas[aria-label^="Lettering proof"]')?.style.width) === 1600 && (${centeredProof})`,
    ),
  );
  await waitFor("actual ink pixels at inspection zoom", () =>
    evaluate<number | false>(inkPixels),
  );
  await assert("100% fitted proof draws real lettering ink", inkPixels);
  await screenshot("fit-proof-inspect");
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === 'Fit').click()`,
  );
  await waitFor("fitted whole-face proof redraws", () =>
    evaluate<boolean>(
      `parseFloat(document.querySelector('canvas[aria-label^="Lettering proof"]')?.style.width) !== 1600 && (${centeredProof})`,
    ),
  );
  await screenshot("fit-proof");
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === 'Expand proof').click()`,
  );
  await waitFor("expanded fitted proof opens", () =>
    evaluate<boolean>(
      `Boolean(document.querySelector('.scale-proof-dialog[open] canvas'))`,
    ),
  );
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === '100%').click()`,
  );
  await waitFor("expanded inspection proof centers", () =>
    evaluate<boolean>(
      `parseFloat(document.querySelector('canvas[aria-label^="Lettering proof"]')?.style.width) === 1600 && (${centeredProof})`,
    ),
  );
  await waitFor("expanded fitted proof ink at inspection zoom", () =>
    evaluate<number | false>(
      `document.querySelector('.scale-proof-dialog[open]') ? (${inkPixels}) : false`,
    ),
  );
  await screenshot("fit-proof-expanded-inspect");
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === 'Fit').click()`,
  );
  await waitFor("expanded whole-face proof redraws", () =>
    evaluate<boolean>(
      `parseFloat(document.querySelector('canvas[aria-label^="Lettering proof"]')?.style.width) !== 1600 && (${centeredProof})`,
    ),
  );
  await screenshot("fit-proof-expanded");
  await request("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await request("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await waitFor("expanded fitted proof closes", () =>
    evaluate<boolean>(
      `!document.querySelector('.scale-proof-dialog[open]') && Boolean(document.querySelector('.scale-proof-viewport canvas'))`,
    ),
  );
  await waitFor("fitted proof expansion button regains focus", () =>
    evaluate<boolean>(
      `document.activeElement?.textContent.trim() === 'Expand proof'`,
    ),
  );
  await evaluate(
    `Array.from(document.querySelectorAll('.scale-proof-tools button')).find(b => b.textContent === '100%').click()`,
  );
  await waitFor("inline inspection proof redraws", () =>
    evaluate<number | false>(
      `parseFloat(document.querySelector('canvas[aria-label^="Lettering proof"]')?.style.width) === 1600 ? (${inkPixels}) : false`,
    ),
  );

  const oldFont = await evaluate<string>(
    `document.querySelector('[data-testid="scales-workbench"]').getAttribute('data-font-id')`,
  );
  const oldProof = await evaluate<string>(
    `document.querySelector('canvas[aria-label^="Lettering proof"]').toDataURL()`,
  );
  await evaluate(
    `(() => { const select = document.querySelector('#scales-font'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'serif'); select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await waitFor("new font commits", () =>
    evaluate<boolean>(
      `(() => { const workbench=document.querySelector('[data-testid="scales-workbench"]'); return workbench?.getAttribute('data-preview-ready') === 'true' && workbench.getAttribute('data-font-id') !== ${JSON.stringify(oldFont)}; })()`,
    ),
  );
  await waitFor("font proof redraw", () =>
    evaluate<boolean>(
      `document.querySelector('canvas[aria-label^="Lettering proof"]').toDataURL() !== ${JSON.stringify(oldProof)}`,
    ),
  );
  await assert(
    "font redraws the proof",
    `document.querySelector('canvas[aria-label^="Lettering proof"]').toDataURL() !== ${JSON.stringify(oldProof)}`,
  );
  await evaluate(
    `document.querySelector('.scale-proof-viewport').scrollIntoView({block:'center'})`,
  );
  await screenshot("font-proof");
  await assert(
    "font selection updates",
    `document.querySelector('#scales-font').value === 'serif'`,
  );
  await evaluate(
    `(() => { const ink=document.querySelector('#scales-ink'); const details=ink.closest('details'); if(details && !details.open) details.querySelector('summary').click(); ink.scrollIntoView({block:'center'}); ink.focus(); })()`,
  );
  await waitFor("ink control is visible and focused", () =>
    evaluate<boolean>(
      `document.activeElement?.id === 'scales-ink' && Boolean(document.querySelector('#scales-ink').getClientRects().length)`,
    ),
  );
  const originalInk = await evaluate<string>(
    `document.querySelector('#scales-ink').value`,
  );
  await evaluate(
    `(() => { const ink=document.querySelector('#scales-ink'); const paper=document.querySelector('#scales-metal'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(ink,paper.value); ink.dispatchEvent(new Event('input',{bubbles:true})); ink.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await diagnose("after equal color dispatch");
  await waitFor("equal colors fail measured contrast", () =>
    evaluate<boolean>(
      `document.querySelector('[data-check="proof-contrast"]')?.getAttribute('data-check-status') === 'fail'`,
    ),
  );
  await assert(
    "low contrast reports needs attention",
    `document.querySelector('[data-testid="scales-visibility"]').getAttribute('data-status') === 'needs-attention'`,
  );
  await evaluate(
    `(() => { const ink=document.querySelector('#scales-ink'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(ink,${JSON.stringify(originalInk)}); ink.dispatchEvent(new Event('input',{bubbles:true})); ink.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await waitFor("restored colors pass measured contrast", () =>
    evaluate<boolean>(
      `document.querySelector('[data-check="proof-contrast"]')?.getAttribute('data-check-status') === 'pass'`,
    ),
  );
  await assert(
    "contrast check recovers after restoring ink",
    `document.querySelector('[data-check="proof-contrast"]').getAttribute('data-check-status') === 'pass'`,
  );
  await assert(
    "scale outline controls and reference comparison are available",
    `Boolean(document.querySelector('#scales-shape-clipped')?.getClientRects().length) && Boolean(document.querySelector('.scales-reference-card')?.getClientRects().length) && /including its (base|plinth)/.test(document.querySelector('.scales-size-card')?.textContent ?? '')`,
  );
  const storedDesign = `JSON.parse(localStorage.getItem('muchado.scale-study.v1'))`;
  const committedShape = `document.querySelector('[data-testid="scales-workbench"]')`;
  const readyShape = `${committedShape}?.getAttribute('data-preview-ready') === 'true'`;
  const originalShapeFingerprint = await evaluate<string>(
    `${committedShape}.getAttribute('data-plate-fingerprint')`,
  );
  await evaluate(`document.querySelector('#scales-shape-diamond').click()`);
  await waitFor("diamond outline commits actual changed geometry", () =>
    evaluate<boolean>(
      `${readyShape} && ${committedShape}.getAttribute('data-plate-shape') === 'diamond' && ${committedShape}.getAttribute('data-plate-fingerprint') !== ${JSON.stringify(originalShapeFingerprint)}`,
    ),
  );
  await assert(
    "shape selection redraws actual plate geometry",
    `${committedShape}.getAttribute('data-plate-shape') === 'diamond' && Boolean(${committedShape}.getAttribute('data-plate-fingerprint')) && ${committedShape}.getAttribute('data-plate-fingerprint') !== ${JSON.stringify(originalShapeFingerprint)}`,
  );
  await evaluate(`document.querySelector('#scales-shape-clipped').click()`);
  await evaluate(
    `(() => { const follow=document.querySelector('#scales-plate-follow-cell'); if(follow.checked) follow.click(); })()`,
  );
  await waitFor("plate ratio can be edited through enabled control", () =>
    evaluate<boolean>(
      `document.querySelector('#scales-plate-aspect')?.disabled === false`,
    ),
  );
  await evaluate(
    `(() => { const select=document.querySelector('#scales-size-unit'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'mm'); select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await waitFor("millimetre shape depth control", () =>
    evaluate<boolean>(
      `Number(document.querySelector('#scales-shape-relief')?.max) > 150`,
    ),
  );
  await evaluate(
    `(() => { for(const [id,value] of [['scales-plate-aspect','1.6'],['scales-corner-cut','0.2'],['scales-plate-taper','-0.15'],['scales-shape-relief','1.4']]) { const input=document.getElementById(id); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); } })()`,
  );
  await waitFor(
    "custom shape and physical depth are stored and committed",
    () =>
      evaluate<boolean>(
        `${readyShape} && ${committedShape}.getAttribute('data-plate-shape') === 'clipped' && Math.abs(Number(${committedShape}.getAttribute('data-plate-aspect'))-1.6)<0.001 && (() => { const g=${storedDesign}.geometry; return g.cornerCut===0.2 && g.plateTaper===-0.15 && Math.abs(g.relief*25.4-1.4)<0.001; })()`,
      ),
  );
  // Depth units were explicitly switched to mm before the synthetic edit.
  const customShapeDraft = await evaluate<string>(
    `localStorage.getItem('muchado.scale-study.v1')`,
  );
  const customShapeFingerprint = await evaluate<string>(
    `${committedShape}.getAttribute('data-plate-fingerprint')`,
  );
  await reload(`Boolean(document.querySelector('#scales-plate-aspect'))`);
  await waitFor(
    "custom shape survives reload with the same generated geometry",
    () =>
      evaluate<boolean>(
        `${readyShape} && ${committedShape}.getAttribute('data-plate-shape') === 'clipped' && ${committedShape}.getAttribute('data-plate-fingerprint') === ${JSON.stringify(customShapeFingerprint)}`,
      ),
  );
  await assert(
    "custom shape and depth survive reload",
    `localStorage.getItem('muchado.scale-study.v1') === ${JSON.stringify(customShapeDraft)} && document.querySelector('#scales-plate-aspect').value === '1.6' && document.querySelector('#scales-corner-cut').value === '0.2' && document.querySelector('#scales-plate-taper').value === '-0.15'`,
  );
  await evaluate(`document.querySelector('#scales-reference-shape').click()`);
  await waitFor("reference shape reset is stored and committed", () =>
    evaluate<boolean>(
      `${readyShape} && Math.abs(Number(${committedShape}.getAttribute('data-plate-aspect'))-1.3)<0.001 && (() => { const g=${storedDesign}.geometry; return g.plateShape==='clipped' && g.cornerCut===0.12 && g.plateTaper===0.12; })()`,
    ),
  );
  await assert(
    "reference shape reset preserves words font size layers and depth",
    `(() => { const before=JSON.parse(${JSON.stringify(customShapeDraft)}), after=${storedDesign}; for(const design of [before,after]) for(const key of ['plateShape','plateAspect','cornerCut','plateTaper']) delete design.geometry[key]; return JSON.stringify(before)===JSON.stringify(after); })()`,
  );
  await evaluate(
    `document.querySelector('.scales-shape-card').scrollIntoView({block:'start'})`,
  );
  await screenshot("tunable-reference-shape");
  await evaluate(
    `document.querySelector('.scales-reference-card').scrollIntoView({block:'start'})`,
  );
  await screenshot("reference-comparison");
  await request("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor,
    mobile: true,
  });
  await waitFor("mobile layout", () => evaluate<boolean>(`innerWidth === 390`));
  await assert(
    "mobile page fits the viewport",
    `document.documentElement.scrollWidth <= innerWidth + 2`,
  );
  await screenshot("home-mobile");
  await request("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor,
    mobile: false,
  });
  await navigate(
    "/foil",
    `document.body.innerText.includes('A poem with no reverse.')`,
  );
  await assert(
    "continuous foil edition remains available",
    `document.body.innerText.includes('A poem with no reverse.') && Boolean(document.querySelector('canvas'))`,
  );
  await screenshot("foil-desktop");
  await evaluate(
    `(() => { const design=JSON.parse(localStorage.getItem('muchado.scale-study.v1')); design.text=''; localStorage.setItem('muchado.scale-study.v1',JSON.stringify(design)); })()`,
  );
  await navigate("/", `Boolean(document.querySelector('#scales-height'))`);
  await waitFor("saved blank draft preview", () =>
    evaluate<boolean>(
      `document.querySelector('[data-testid="scales-workbench"]')?.getAttribute('data-preview-ready') === 'true' && document.querySelector('[data-testid="scales-visibility"]')?.getAttribute('data-status') === 'empty'`,
    ),
  );
  await reload(`Boolean(document.querySelector('#scales-height'))`);
  await waitFor("saved blank draft after reload", () =>
    evaluate<boolean>(
      `document.querySelector('[data-testid="scales-visibility"]')?.getAttribute('data-status') === 'empty'`,
    ),
  );
  await assert(
    "intentionally blank wording survives reload",
    `JSON.parse(localStorage.getItem('muchado.scale-study.v1')).text === '' && document.querySelector('[data-testid="scales-visibility"]').getAttribute('data-status') === 'empty'`,
  );
  await evaluate(
    `(() => { const design=${storedDesign}; design.text='Silence sings softly.'; localStorage.setItem('muchado.scale-study.v1',JSON.stringify(design)); })()`,
  );
  await reload(`Boolean(document.querySelector('#scales-starting-shape'))`);
  await waitFor("synthetic wording preview before reference preset", () =>
    evaluate<boolean>(`${readyShape}`),
  );
  const beforeReferenceFingerprint = await evaluate<string>(
    `${committedShape}.getAttribute('data-plate-fingerprint')`,
  );
  await evaluate(
    `(() => { const select=document.querySelector('#scales-starting-shape'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'wood-photo-reference'); select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await waitFor("archival reference preset commits generated wood plates", () =>
    evaluate<boolean>(
      `${readyShape} && ${committedShape}.getAttribute('data-plate-shape') === 'clipped' && ${committedShape}.getAttribute('data-plate-fingerprint') !== ${JSON.stringify(beforeReferenceFingerprint)} && document.querySelector('[data-testid="scale-body-dimensions"]')?.textContent.includes('Bare body + jaw, excluding base') && ${storedDesign}.geometry.modelId === 'archival'`,
    ),
  );
  await assert(
    "archival photo preset keeps words and displays body proportions excluding base",
    `(() => { const ratio=parseFloat(document.querySelector('[data-testid="scale-face-proportions"] dd')?.textContent ?? ''); return ${storedDesign}.text === 'Silence sings softly.' && ${committedShape}.getAttribute('data-plate-shape') === 'clipped' && document.querySelector('[data-testid="scale-body-dimensions"]')?.textContent.includes('Bare body + jaw, excluding base') && ratio >= 1.1 && ratio <= 1.7; })()`,
  );
  await evaluate(
    `document.querySelector('[data-testid="scales-workbench"]').scrollIntoView({block:'start'})`,
  );
  // The committed preview precedes the 320 ms skin / 420 ms camera fades.
  // Let that visible transition finish before capturing the reference model.
  await Bun.sleep(700);
  await screenshot("archival-photo-shape");
  results.push({
    name: "no app JavaScript exceptions",
    passed: errors.length === 0,
    detail: errors,
  });
  if (errors.length)
    throw new Error(`App JavaScript exceptions: ${errors.join("\n")}`);
} catch (error) {
  await diagnose("failure");
  failure = error;
  results.push({
    name: "smoke execution",
    passed: false,
    detail: String(error),
  });
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await screenshot("failure");
    } catch {}
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await request("Browser.close");
    } catch {
      /* Chrome may close before replying. */
    }
  }
  socket?.close();
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error("Browser test closed"));
  }
  pending.clear();
  if (browser) {
    if (browser.exitCode === null) browser.kill("SIGTERM");
    const exited = await Promise.race([
      browser.exited.then(() => true),
      Bun.sleep(3000).then(() => false),
    ]);
    if (!exited) {
      console.log(
        `Terminating unresponsive owned test browser PID ${browser.pid}`,
      );
      browser.kill("SIGKILL");
      const killed = await Promise.race([
        browser.exited.then(() => true),
        Bun.sleep(5000).then(() => false),
      ]);
      if (!killed) {
        failure ??= new Error(
          `Owned test browser PID ${browser.pid} did not exit after SIGKILL`,
        );
        results.push({
          name: "owned browser cleanup",
          passed: false,
          detail: String(failure),
        });
      }
    }
  }
  if (stderrFd !== undefined) closeSync(stderrFd);
  await app?.stop();
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  await mkdir(options.output, { recursive: true });
  await Bun.write(
    join(options.output, "results.json"),
    JSON.stringify(
      {
        origin,
        headless: options.headless,
        deviceScaleFactor,
        requestedBackend: graphics.requestedBackend,
        results,
        errors,
        passed: !failure,
      },
      null,
      2,
    ),
  );
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
} else
  console.log(
    `Browser smoke passed. Screenshots and results: ${options.output}`,
  );
