import { afterAll, afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, createRef, type ReactNode } from "react";
import { DEFAULT_WORKSHEET_SETTINGS } from "../shared/worksheet";
import type { CalligraphyChatHandle } from "../src/components/calligraphy/calligraphy-chat-strip";
import { calligraphyToolHelp } from "../src/lib/calligraphy-help";

// Run in a separate Bun process: DOM globals and module mocks must not leak
// into the server suite. This simulates DOM interactions, not browser layout.
GlobalRegistrator.register({ url: "http://localhost/" });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { CalligraphyChatStrip } = await import(
  "../src/components/calligraphy/calligraphy-chat-strip"
);
const { WorksheetPaperSurface } = await import(
  "../src/components/calligraphy/worksheet-paper-surface"
);
const { WorksheetSpecialWords } = await import(
  "../src/components/calligraphy/worksheet-special-words"
);
const { WorksheetFontCreator } = await import(
  "../src/components/calligraphy/worksheet-font-creator"
);

const failMap = process.env.CALLIGRAPHY_TEST_MAP_FAILURE === "1";
mock.module("@xyflow/react", () => {
  if (failMap) throw new Error("Synthetic map download failure");
  return {
    ReactFlow: ({ children }: { children: ReactNode }) => (
      <section aria-label="Loaded interactive map">{children}</section>
    ),
    Background: () => null,
    Controls: () => null,
  };
});
const { CalligraphyWorkflow } = await import(
  "../src/components/calligraphy/calligraphy-workflow"
);
const container = document.createElement("div");
document.body.append(container);
let root = createRoot(container);
const originalFetch = globalThis.fetch;

afterEach(async () => {
  await act(() => root.unmount());
  root = createRoot(container);
  globalThis.fetch = originalFetch;
});
afterAll(async () => {
  await act(() => root.unmount());
  await GlobalRegistrator.unregister();
});

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (item) =>
      item.getAttribute("aria-label") === name ||
      item.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}

async function click(name: string): Promise<void> {
  await act(() => {
    const target = button(name);
    target.focus();
    target.click();
  });
}

if (!failMap) {
  test("font creator help retains glyph reactions through the inline launcher", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["calligraphy-assistant-capability"], {
      available: false,
      models: [],
      webSearch: false,
      transport: "ollama",
    });
    globalThis.fetch = Object.assign(
      async () => {
        throw new Error("Offline guidance stays local");
      },
      { preconnect: originalFetch.preconnect },
    );
    const chat = createRef<CalligraphyChatHandle>();
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <WorksheetFontCreator
            hasPhoto={false}
            isCalibrated={false}
            onOpenReference={() => undefined}
            onOpenSizing={() => undefined}
            photoUpload={null}
            letterRounds={null}
            onHelp={(context) => chat.current?.help(context)}
          />
          <CalligraphyChatStrip
            ref={chat}
            settings={DEFAULT_WORKSHEET_SETTINGS}
            disabled={false}
            helpContext={calligraphyToolHelp("font")}
            onApplySettings={() => false}
            onSelect={() => undefined}
          />
        </QueryClientProvider>,
      ),
    );
    await click("Help with this step");
    await click("Plan my next glyph");
    expect(container.querySelector(".ck-chat-history")?.textContent).toContain(
      "FontForge assembly",
    );
    client.clear();
  });

  test("Qwen reactions use the current tool, preserve a draft, and wait for an explicit click", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["calligraphy-assistant-capability"], {
      available: true,
      models: ["qwen3.5:27b"],
      webSearch: false,
      transport: "ollama",
    });
    globalThis.fetch = Object.assign(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body)));
        return Response.json({
          answer: "Compare one name beside the surrounding script.",
          model: "qwen3.5:27b",
          sources: [],
          warnings: [],
          searched: false,
        });
      },
      { preconnect: originalFetch.preconnect },
    );
    const render = (tool: "words" | "materials") =>
      root.render(
        <QueryClientProvider client={client}>
          <CalligraphyChatStrip
            settings={DEFAULT_WORKSHEET_SETTINGS}
            disabled={false}
            helpContext={calligraphyToolHelp(tool)}
            onApplySettings={() => {
              throw new Error("Reactions must not edit settings");
            }}
            onSelect={() => {
              throw new Error("Reactions must not navigate");
            }}
          />
        </QueryClientProvider>,
      );
    await act(() => render("words"));
    const input = container.querySelector<HTMLInputElement>(
      'input[id$="-compact-input"]',
    );
    if (!input) throw new Error("Missing chat input");
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "My unfinished question");
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true }));
    });
    await click("Open studio chat");
    expect(requests).toHaveLength(0);
    await click("Review my font pairing");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.question).toContain("Words & poems");
    expect(requests[0]?.question).toContain("font pairing");
    expect(requests[0]?.web).toBe(false);
    expect(input.value).toBe("My unfinished question");
    expect(container.querySelector(".ck-chat-history")?.textContent).toContain(
      "Compare one name",
    );
    const moreReactions = container.querySelector(".ck-reactions summary");
    if (!(moreReactions instanceof HTMLElement))
      throw new Error("Missing reaction disclosure");
    await act(() => moreReactions.click());
    expect(
      container.querySelector<HTMLDetailsElement>(".ck-reactions details")
        ?.open,
    ).toBe(true);
    await click("Explain more simply");
    expect(requests[1]?.history).toEqual([
      { role: "user", content: "Review my font pairing" },
      {
        role: "assistant",
        content: "Compare one name beside the surrounding script.",
      },
    ]);
    await click("Close studio chat");
    await act(() => render("materials"));
    await click("Open studio chat");
    expect(requests).toHaveLength(2);
    expect(button("Plan an ink test")).toBeDefined();
    await click("Plan an ink test");
    expect(requests[2]?.question).toContain("At the mixing table");
    expect(requests[2]?.question).not.toContain("Words & poems");
    expect(input.value).toBe("My unfinished question");
    client.clear();
  });

  test("offline reactions give specific local guidance without claiming a Qwen answer", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["calligraphy-assistant-capability"], {
      available: false,
      models: [],
      webSearch: false,
      transport: "ollama",
    });
    globalThis.fetch = Object.assign(
      async () => {
        throw new Error("Offline reactions stay local");
      },
      { preconnect: originalFetch.preconnect },
    );
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <CalligraphyChatStrip
            settings={DEFAULT_WORKSHEET_SETTINGS}
            disabled={false}
            helpContext={calligraphyToolHelp("words")}
            onApplySettings={() => {
              throw new Error("Must not apply");
            }}
            onSelect={() => {
              throw new Error("Must not navigate");
            }}
          />
        </QueryClientProvider>,
      ),
    );
    await click("Open studio chat");
    await click("Review my font pairing");
    const reply = container.querySelector(
      '.ck-chat-history article[data-role="assistant"]',
    );
    expect(reply?.textContent).toContain("Studio library (offline)");
    expect(reply?.textContent).toContain("Special words");
    expect(reply?.textContent).not.toContain("qwen3.5");
    client.clear();
  });

  test("special lettering previews a draft, applies the chosen font, and removes it without changing the poem", async () => {
    let settings = { ...DEFAULT_WORKSHEET_SETTINGS, specialWords: "Ann Marie" };
    const text = "Dear Ann Marie, welcome home.";
    const render = () =>
      root.render(
        <WorksheetSpecialWords
          settings={settings}
          text={text}
          disabled={false}
          onChange={(patch) => {
            settings = { ...settings, ...patch };
            render();
          }}
        />,
      );
    await act(render);
    expect(container.textContent).toContain("1 matching phrase");
    const select = container.querySelector("select");
    if (!select) throw new Error("Missing special font selector");
    await act(() => {
      select.value = "italianno";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    expect(settings.specialFontId).toBe("pinyon-script");
    await click("Apply special lettering");
    expect(settings.specialFontId).toBe("italianno");
    expect(settings.specialWords).toBe("Ann Marie");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "saved",
    );
    await click("Use main font for all words");
    expect(settings.specialWords).toBe("");
    expect(container.querySelector("textarea")?.value).toBe("");
  });

  test("compact paper selection displays every material and preserves the brand note", async () => {
    let paperName = "Smooth calligraphy paper · Example brand";
    const render = () =>
      root.render(
        <WorksheetPaperSurface
          compact
          settings={{ ...DEFAULT_WORKSHEET_SETTINGS, paperName }}
          onChange={(patch) => {
            paperName = patch.paperName ?? paperName;
            render();
            return true;
          }}
        />,
      );
    await act(render);
    const select = container.querySelector("select");
    if (!select) throw new Error("Missing compact paper selector");
    expect(select.value).toBe("smooth");
    for (const [value, expected] of [
      ["dark", "Opaque or dark paper / card · Example brand"],
      ["vellum", "Translucent tracing paper / drafting vellum · Example brand"],
      ["printer", "Printer paper · Example brand"],
      ["smooth", "Smooth calligraphy paper · Example brand"],
    ] as const) {
      await act(() => {
        select.value = value;
        select.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
      expect(paperName).toBe(expected);
      expect(select.value).toBe(value);
    }
  });

  test("offline help gives the selected local instruction without changing the sheet", async () => {
    const client = new QueryClient();
    client.setQueryData(["calligraphy-assistant-capability"], {
      available: false,
      models: [],
      webSearch: false,
      transport: "ollama",
    });
    globalThis.fetch = Object.assign(
      () => {
        throw new Error("Offline help must stay local");
      },
      { preconnect: originalFetch.preconnect },
    );
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <CalligraphyChatStrip
            settings={DEFAULT_WORKSHEET_SETTINGS}
            disabled={false}
            helpContext={{
              title: "Paper",
              instruction: "Match the printer stock.",
            }}
            onApplySettings={() => {
              throw new Error("Help must not apply settings");
            }}
            onSelect={() => {
              throw new Error("Help must not navigate");
            }}
          />
        </QueryClientProvider>,
      ),
    );
    await click("Help now");
    expect(container.querySelector(".ck-chat-history")?.textContent).toContain(
      "Match the printer stock.",
    );
    expect(container.querySelector(".ck-chat-history")?.textContent).toContain(
      "Studio library (offline)",
    );
    await click("Back to my work");
    expect(document.activeElement === button("Help now")).toBe(true);
    client.clear();
  });

  test("Help now preserves the draft, sends selected context, cancels and restores focus", async () => {
    let pendingSignal: AbortSignal | null | undefined;
    let body: Record<string, unknown> | undefined;
    let settingsApplied = false;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["calligraphy-assistant-capability"], {
      available: true,
      models: ["qwen3.5:27b"],
      webSearch: false,
      transport: "ollama",
    });
    const fetchMock = mock((_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      pendingSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        pendingSignal?.addEventListener("abort", () =>
          reject(new DOMException("Cancelled", "AbortError")),
        );
      });
    });
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect: originalFetch.preconnect,
    });
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <CalligraphyChatStrip
            settings={DEFAULT_WORKSHEET_SETTINGS}
            disabled={false}
            helpContext={{
              title: "Letterforms · Size & spacing",
              instruction: "Adjust lowercase height.",
            }}
            onApplySettings={() => {
              settingsApplied = true;
              return true;
            }}
            onSelect={() => {
              throw new Error("Help must not navigate");
            }}
          />
        </QueryClientProvider>,
      ),
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[id$="-compact-input"]',
    );
    if (!input) throw new Error("Missing compact chat input");
    await act(() => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "Keep my unfinished question");
      input.dispatchEvent(
        new window.InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
        }),
      );
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    expect(button("Ask studio assistant").disabled).toBe(false);
    const launcher = button("Help now");
    await click("Help now");
    expect(body?.question).toContain("Letterforms · Size & spacing");
    expect(button("Spot one improvement").disabled).toBe(true);
    expect(body?.question).toContain("Adjust lowercase height.");
    expect(body?.settings).toEqual(DEFAULT_WORKSHEET_SETTINGS);
    expect(input.value).toBe("Keep my unfinished question");
    expect(
      container.querySelector<HTMLDialogElement>(".ck-chat-dialog")?.open,
    ).toBe(true);
    await click("Back to my work");
    expect(pendingSignal?.aborted).toBe(true);
    expect(
      container.querySelector<HTMLDialogElement>(".ck-chat-dialog")?.open,
    ).toBe(false);
    expect(document.activeElement === launcher).toBe(true);
    expect(input.value).toBe("Keep my unfinished question");
    expect(settingsApplied).toBe(false);
    client.clear();
  });
}

test(`workflow path controls remain usable after map ${failMap ? "failure" : "loading"}`, async () => {
  let opened = "";
  let journey = "";
  await act(() =>
    root.render(
      <CalligraphyWorkflow
        onSelect={(tool) => {
          opened = tool;
        }}
        onStartJourney={(path) => {
          journey = path;
        }}
      />,
    ),
  );
  if (failMap) {
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "could not load",
    );
  } else {
    expect(
      container.querySelector('[aria-label="Loaded interactive map"]'),
    ).not.toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  }
  await click("Follow this path");
  expect(journey).toBe("practice");
  await click("Paper");
  expect(opened).toBe("paper");
});
