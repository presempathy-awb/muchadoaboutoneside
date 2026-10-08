import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../../shared/worksheet";
import {
  CalligraphyChatStrip,
  rollbackPendingChatTurn,
} from "./calligraphy-chat-strip";

test("studio strip keeps chat and both settings paths reachable", () => {
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <CalligraphyChatStrip
        settings={DEFAULT_WORKSHEET_SETTINGS}
        disabled={false}
        onApplySettings={() => true}
        onSelect={() => undefined}
      />
    </QueryClientProvider>,
  );

  expect(html).toContain("Studio chat");
  expect(html).toContain("Suggested settings");
  expect(html).toContain("Requirements wizard");
  expect(html).toContain("Web research");
  expect(html).toContain("Clear session");
  expect(html).toContain('aria-label="Open studio chat"');
  expect(html).toContain('aria-label="Help now"');
  expect(html).toContain("Explain this step");
});

test("a failed request removes only its pending user turn", () => {
  const completed = Array.from({ length: 6 }, (_, index) => ({
    id: `completed-${index}`,
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `Earlier message ${index}`,
  }));
  const messages = [
    ...completed,
    { id: "pending", role: "user" as const, content: "Try this question" },
  ];

  expect(rollbackPendingChatTurn(messages, "pending")).toEqual(completed);
});
