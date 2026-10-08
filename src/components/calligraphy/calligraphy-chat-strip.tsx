import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Globe2,
  LifeBuoy,
  MessageCircle,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  CalligraphyAssistantReply,
  CalligraphyAssistantRequest,
  CalligraphyMessage,
} from "../../../shared/calligraphy-assistant";
import type { CalligraphyRequirements } from "../../../shared/calligraphy-settings";
import type { WorksheetSettings } from "../../../shared/worksheet";
import {
  askCalligraphyAssistant,
  calligraphySettingsFingerprint,
  getCalligraphyAssistantCapability,
  trimCalligraphyHistory,
} from "../../lib/calligraphy-assistant";
import { calligraphyGuideReply } from "../../lib/calligraphy-guide";
import {
  type CalligraphyHelpContext,
  calligraphyHelpQuestion,
  calligraphyToolHelp,
} from "../../lib/calligraphy-help";
import { Button } from "../ui/button";
import type { CalligraphyTool } from "./calligraphy-cockpit";
import { CalligraphyReactions } from "./calligraphy-reactions";
import { CalligraphySettingsWizard } from "./calligraphy-settings-wizard";

interface DisplayMessage extends CalligraphyMessage {
  id: string;
  sources?: CalligraphyAssistantReply["sources"];
  warnings?: string[];
  model?: string;
}

function trimDisplayMessages(messages: DisplayMessage[]) {
  return messages.slice(-6);
}

/** Remove the unmatched user turn after its assistant request fails or is canceled. */
export function rollbackPendingChatTurn(
  messages: readonly DisplayMessage[],
  pendingId: string,
): DisplayMessage[] {
  return messages.filter((message) => message.id !== pendingId);
}

export interface CalligraphyChatHandle {
  help: (context: CalligraphyHelpContext) => void;
}

export function CalligraphyChatStrip({
  onSelect,
  settings,
  disabled,
  onApplySettings,
  helpContext = calligraphyToolHelp("paper"),
  ref,
}: {
  onSelect: (tool: CalligraphyTool) => void;
  settings: WorksheetSettings;
  disabled: boolean;
  onApplySettings: (settings: WorksheetSettings) => boolean;
  helpContext?: CalligraphyHelpContext;
  ref?: Ref<CalligraphyChatHandle>;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const compactInput = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [model, setModel] = useState("");
  const [web, setWeb] = useState(false);
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState<CalligraphyHelpContext>();
  const [restoreLauncher, setRestoreLauncher] = useState(false);
  const [previousSettings, setPreviousSettings] = useState<{
    before: WorksheetSettings;
    appliedFingerprint: string;
  }>();

  const capability = useQuery({
    queryKey: ["calligraphy-assistant-capability"],
    queryFn: ({ signal }) => getCalligraphyAssistantCapability(signal),
    retry: false,
    staleTime: 60_000,
  });
  const assistant = capability.data;
  const assistantStatus = capability.isPending
    ? "Checking Qwen…"
    : assistant?.available
      ? `${model || "Qwen"} · ${Math.floor(messages.length / 2)} exchanges`
      : "Local library · Qwen offline";
  useEffect(() => {
    if (!assistant?.models.length) return;
    setModel((current) =>
      assistant.models.includes(current)
        ? current
        : (assistant.models[0] ?? ""),
    );
  }, [assistant]);

  const request = useMutation({
    retry: 0,
    mutationFn: ({
      body,
      controller,
    }: {
      body: CalligraphyAssistantRequest;
      controller: AbortController;
    }) => askCalligraphyAssistant(body, controller.signal),
  });

  function openChat() {
    if (!dialog.current?.open) {
      setRestoreLauncher(false);
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.current?.showModal();
    }
  }

  useEffect(() => {
    if (!restoreLauncher || request.isPending || dialog.current?.open) return;
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    else compactInput.current?.focus();
    setRestoreLauncher(false);
  }, [restoreLauncher, request.isPending]);

  function helpNow(context: CalligraphyHelpContext) {
    if (
      disabled ||
      capability.isPending ||
      request.isPending ||
      activeRequest.current
    )
      return;
    setGuidance(context);
    void ask("Help me with this step.", context, true);
  }

  useImperativeHandle(ref, () => ({ help: helpNow }));

  function appendReply(reply: CalligraphyAssistantReply) {
    setMessages((current) =>
      trimDisplayMessages([
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply.answer,
          sources: reply.sources,
          warnings: reply.warnings,
          model: reply.model,
        },
      ]),
    );
  }

  async function ask(
    userQuestion: string,
    context = guidance,
    preserveDraft = false,
    reaction?: { question: string; offline: string },
  ) {
    const clean = userQuestion.trim();
    if (!clean || request.isPending || activeRequest.current) return;
    if (!preserveDraft) setQuestion("");
    setError("");
    openChat();
    if (!assistant?.available || !model) {
      const local = reaction
        ? { text: reaction.offline }
        : context
          ? {
              text: `${context.instruction}${context.next ? ` Next in this process: ${context.next}` : ""}`,
            }
          : calligraphyGuideReply(clean);
      setMessages((current) =>
        trimDisplayMessages([
          ...current,
          { id: crypto.randomUUID(), role: "user", content: clean },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Studio library (offline): ${local.text}`,
            sources:
              local.source && local.sourceLabel
                ? [
                    {
                      id: local.source,
                      title: local.sourceLabel,
                      url: local.source,
                      kind: "library" as const,
                    },
                  ]
                : [],
            model: "Local studio library",
          },
        ]),
      );
      if (local.tool && !context) onSelect(local.tool);
      return;
    }
    const controller = new AbortController();
    const pendingId = crypto.randomUUID();
    activeRequest.current = controller;
    setMessages((current) => [
      ...current,
      { id: pendingId, role: "user", content: clean },
    ]);
    try {
      const reply = await request.mutateAsync({
        controller,
        body: {
          kind: "chat",
          question: context
            ? calligraphyHelpQuestion(context, reaction?.question ?? clean)
            : clean,
          model,
          web: Boolean(web && assistant.webSearch),
          history: trimCalligraphyHistory(messages),
          settings,
        },
      });
      appendReply(reply);
    } catch (cause) {
      setMessages((current) => rollbackPendingChatTurn(current, pendingId));
      setError(
        controller.signal.aborted
          ? "Request canceled. Your draft was not changed."
          : cause instanceof Error
            ? cause.message
            : "Qwen could not answer.",
      );
      if (!preserveDraft) setQuestion((current) => current || clean);
    } finally {
      if (activeRequest.current === controller)
        activeRequest.current = undefined;
    }
  }

  async function requestSettings(
    requirements: CalligraphyRequirements,
    base: WorksheetSettings,
  ) {
    if (!assistant?.available || !model) {
      throw new Error(
        "Qwen 27 is not available right now. Use the formula calculation instead.",
      );
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      return await request.mutateAsync({
        controller,
        body: {
          kind: "settings",
          question:
            "Optimize this practice sheet for the supplied requirements. Explain the tradeoffs and return a bounded proposal.",
          model,
          web: false,
          history: [],
          settings: base,
          requirements,
        },
      });
    } finally {
      if (activeRequest.current === controller)
        activeRequest.current = undefined;
    }
  }

  function applySettings(next: WorksheetSettings) {
    const before = settings;
    if (!onApplySettings(next)) return false;
    setPreviousSettings({
      before,
      appliedFingerprint: calligraphySettingsFingerprint(next),
    });
    return true;
  }

  return (
    <section
      className="ck-chat-strip"
      aria-label="Calligraphy studio assistant"
    >
      <CalligraphySettingsWizard
        settings={settings}
        available={Boolean(assistant?.available)}
        model={model}
        disabled={disabled || request.isPending}
        onRequestAi={requestSettings}
        onApply={applySettings}
        onCancelRequest={() => activeRequest.current?.abort()}
        onHelp={helpNow}
        onUndo={
          previousSettings?.appliedFingerprint ===
          calligraphySettingsFingerprint(settings)
            ? () => {
                if (onApplySettings(previousSettings.before))
                  setPreviousSettings(undefined);
              }
            : undefined
        }
      />
      <form
        className="ck-chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <div className="ck-chat-entry">
          <button
            type="button"
            className="ck-help-now"
            aria-label="Help now"
            aria-describedby={`${id}-compact-disclosure`}
            disabled={disabled || capability.isPending || request.isPending}
            onClick={() => helpNow(helpContext)}
          >
            <LifeBuoy size={19} aria-hidden="true" />
            <span>
              <strong>Help now</strong>
              <small>Explain this step</small>
            </span>
          </button>
          <button
            type="button"
            className="ck-chat-open"
            onClick={() => {
              setGuidance(undefined);
              openChat();
            }}
            aria-label="Open studio chat"
          >
            <MessageCircle size={20} aria-hidden="true" />
            <span>
              <strong>Studio chat</strong>
              <small>{assistantStatus}</small>
            </span>
          </button>
        </div>
        <label className="sr-only" htmlFor={`${id}-compact-input`}>
          Ask the calligraphy assistant
        </label>
        <input
          id={`${id}-compact-input`}
          ref={compactInput}
          value={question}
          maxLength={2_000}
          placeholder="Ask about ink, paper, lettering or printing…"
          onChange={(event) => setQuestion(event.target.value)}
          aria-describedby={`${id}-compact-disclosure`}
        />
        {request.isPending ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => activeRequest.current?.abort()}
          >
            <Square size={16} aria-hidden="true" /> Cancel
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!question.trim()}
            aria-label="Ask studio assistant"
          >
            <Send size={18} aria-hidden="true" /> Ask
          </Button>
        )}
        <small id={`${id}-compact-disclosure`} className="ck-chat-disclosure">
          {assistant?.available
            ? "Qwen receives questions, this step and sheet settings. Photos, poem drafts and notes aren't attached."
            : "Uses the local studio library while Qwen is offline."}
        </small>
      </form>
      <dialog
        ref={dialog}
        className="ck-chat-dialog"
        aria-labelledby={`${id}-chat-title`}
        onClose={() => setRestoreLauncher(true)}
        onCancel={() => activeRequest.current?.abort()}
      >
        <header>
          <div>
            <p>Calligraphy knowledge + your current sheet</p>
            <h2 id={`${id}-chat-title`}>
              {guidance ? "Let's take the next step" : "Studio chat"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              activeRequest.current?.abort();
              dialog.current?.close();
            }}
            aria-label="Close studio chat"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="ck-chat-options">
          <label>
            Model
            <select
              value={model}
              disabled={!assistant?.available || request.isPending}
              onChange={(event) => setModel(event.target.value)}
            >
              {assistant?.models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="ck-chat-web">
            <input
              type="checkbox"
              checked={web}
              disabled={!assistant?.webSearch || request.isPending}
              onChange={(event) => setWeb(event.target.checked)}
            />
            <Globe2 size={16} aria-hidden="true" /> Web research
            {!assistant?.webSearch && (
              <small>Search provider not connected</small>
            )}
          </label>
          <p>
            {assistant?.available
              ? "Questions and current sheet settings are sent to the selected Qwen model. Web research runs only when checked."
              : "Qwen is unavailable. Answers are clearly labeled and drawn only from the local studio library."}
          </p>
        </div>
        <div className="ck-chat-history" aria-live="polite">
          {guidance && (
            <aside className="ck-help-context">
              <strong>{guidance.title}</strong>
              <p>
                Guidance for the step you opened. Return to your work to make
                changes.
              </p>
            </aside>
          )}
          {messages.length === 0 ? (
            <div className="ck-chat-empty">
              <BookOpen size={28} aria-hidden="true" />
              <h3>Ask from the workbench</h3>
              <p>
                Try “Why are my hairlines feathering?” or “How should I space
                Copperplate on vellum?”
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} data-role={message.role}>
                <strong>
                  {message.role === "user"
                    ? "You"
                    : message.model || "Studio assistant"}
                </strong>
                <p>{message.content}</p>
                {message.warnings?.map((warning) => (
                  <p className="ck-chat-warning" key={warning}>
                    {warning}
                  </p>
                ))}
                {message.sources && message.sources.length > 0 && (
                  <ul className="ck-chat-sources">
                    {message.sources.map((source) => (
                      <li key={source.id}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))
          )}
          {request.isPending && (
            <p role="status">
              Qwen is reading the studio library
              {web ? " and researching the web" : ""}…
            </p>
          )}
          {error && (
            <p className="ws-error" role="alert">
              {error}
            </p>
          )}
          <CalligraphyReactions
            context={guidance ?? helpContext}
            available={Boolean(assistant?.available)}
            hasReply={messages.some((message) => message.role === "assistant")}
            disabled={disabled || capability.isPending || request.isPending}
            onReact={(reaction) => {
              const context = guidance ?? helpContext;
              setGuidance(context);
              void ask(reaction.label, context, true, reaction);
            }}
          />
        </div>
        <form
          className="ck-chat-dialog-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          {guidance && (
            <nav className="ck-help-followups" aria-label="Guidance follow-ups">
              <button
                type="button"
                onClick={() => {
                  activeRequest.current?.abort();
                  dialog.current?.close();
                }}
              >
                Back to my work
              </button>
            </nav>
          )}
          <label className="sr-only" htmlFor={`${id}-dialog-input`}>
            Message
          </label>
          <textarea
            id={`${id}-dialog-input`}
            rows={2}
            maxLength={2_000}
            value={question}
            placeholder="Ask a follow-up…"
            onChange={(event) => setQuestion(event.target.value)}
          />
          {request.isPending ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => activeRequest.current?.abort()}
            >
              <Square size={16} aria-hidden="true" /> Cancel
            </Button>
          ) : (
            <Button type="submit" disabled={!question.trim()}>
              <Send size={18} aria-hidden="true" /> Ask
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={messages.length === 0 || request.isPending}
            onClick={() => {
              setMessages([]);
              setError("");
              setGuidance(undefined);
            }}
          >
            <Trash2 size={17} aria-hidden="true" /> Clear session
          </Button>
        </form>
      </dialog>
    </section>
  );
}
