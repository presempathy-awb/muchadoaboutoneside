import { defaultKeymap } from "@codemirror/commands";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { WorksheetSession } from "@/lib/worksheet-store";

const MAX_TEXT_LENGTH = 20_000;

const editorTheme = EditorView.theme({
  "&": {
    minHeight: "11rem",
    backgroundColor: "transparent",
    fontSize: "1rem",
  },
  ".cm-content": {
    minHeight: "11rem",
    padding: "0.9rem 1rem",
    fontFamily: "var(--font-serif)",
    lineHeight: "1.6",
    caretColor: "currentColor",
  },
  ".cm-line": { padding: "0" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-placeholder": { color: "#77736d" },
  "&.cm-focused": { outline: "2px solid currentColor", outlineOffset: "2px" },
});

function lengthLimit(onLimit: () => void) {
  return EditorState.transactionFilter.of((transaction) => {
    if (
      !transaction.docChanged ||
      transaction.annotation(Transaction.userEvent) === undefined ||
      transaction.newDoc.length <= MAX_TEXT_LENGTH
    )
      return transaction;
    onLimit();
    return [];
  });
}

function useUndoState(session: WorksheetSession) {
  const [state, setState] = useState({ canUndo: false, canRedo: false });
  useEffect(() => {
    const update = () =>
      setState({
        canUndo: session.undo.canUndo(),
        canRedo: session.undo.canRedo(),
      });
    update();
    session.undo.on("stack-item-added", update);
    session.undo.on("stack-item-popped", update);
    session.undo.on("stack-cleared", update);
    return () => {
      session.undo.off("stack-item-added", update);
      session.undo.off("stack-item-popped", update);
      session.undo.off("stack-cleared", update);
    };
  }, [session]);
  return state;
}

export function WorksheetEditor({ session }: { session: WorksheetSession }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const undoState = useUndoState(session);

  useEffect(() => {
    let active = true;
    session.ready.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: session.text.toString(),
        extensions: [
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": "Practice text",
            "aria-describedby": "worksheet-text-help",
          }),
          placeholder("Type or paste the words you want to practise…"),
          editorTheme,
          lengthLimit(() => setLimitReached(true)),
          yCollab(session.text, null, { undoManager: session.undo }),
        ],
      }),
      parent: host,
    });
    return () => view.destroy();
  }, [ready, session]);

  useEffect(() => {
    if (!limitReached) return;
    const timer = window.setTimeout(() => setLimitReached(false), 5000);
    return () => window.clearTimeout(timer);
  }, [limitReached]);

  return (
    <div className="worksheet-editor">
      <div
        className="worksheet-editor-toolbar"
        role="toolbar"
        aria-label="Practice text history"
      >
        <button
          type="button"
          onClick={() => session.undo.undo()}
          disabled={!undoState.canUndo}
          aria-label="Undo practice text change"
        >
          <Undo2 aria-hidden="true" size={16} /> Undo
        </button>
        <button
          type="button"
          onClick={() => session.undo.redo()}
          disabled={!undoState.canRedo}
          aria-label="Redo practice text change"
        >
          <Redo2 aria-hidden="true" size={16} /> Redo
        </button>
      </div>
      <div ref={hostRef} aria-busy={!ready} />
      <p id="worksheet-text-help" className="worksheet-editor-help">
        One line here becomes one line of example writing. Your private draft is
        limited to {MAX_TEXT_LENGTH.toLocaleString()} characters.
      </p>
      {limitReached && (
        <p role="status">
          The edit was stopped because practice text is limited to{" "}
          {MAX_TEXT_LENGTH.toLocaleString()} characters.
        </p>
      )}
    </div>
  );
}
