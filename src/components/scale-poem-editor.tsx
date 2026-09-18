import { defaultKeymap } from "@codemirror/commands";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

/** The caller persists this Yjs working text with the complete scale study. */
export default function ScalePoemEditor({
  value,
  onChange,
}: {
  value: string;
  onChange(text: string): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const currentValue = useRef(value);
  currentValue.current = value;
  const editor = useRef<{
    doc: Y.Doc;
    text: Y.Text;
    undo: Y.UndoManager;
  } | null>(null);
  const [limit, setLimit] = useState(false);
  const [history, setHistory] = useState({ undo: false, redo: false });
  useEffect(() => {
    if (!host.current) return;
    const doc = new Y.Doc();
    const text = doc.getText("scale-poem");
    text.insert(0, currentValue.current);
    const undo = new Y.UndoManager(text);
    editor.current = { doc, text, undo };
    const changed = () => {
      const next = text.toString();
      if (next !== currentValue.current) callback.current(next);
    };
    const updateHistory = () =>
      setHistory({ undo: undo.canUndo(), redo: undo.canRedo() });
    text.observe(changed);
    undo.on("stack-item-added", updateHistory);
    undo.on("stack-item-popped", updateHistory);
    undo.on("stack-cleared", updateHistory);
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text.toString(),
        extensions: [
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": "Words to place on the sculpture",
            "aria-describedby": "scales-text-help",
          }),
          placeholder(
            "Begin with a word, a poem, or a little room for possibility…",
          ),
          EditorState.transactionFilter.of((transaction) => {
            if (
              transaction.docChanged &&
              transaction.annotation(Transaction.userEvent) !== undefined &&
              transaction.newDoc.length > 20_000
            ) {
              setLimit(true);
              return [];
            }
            return transaction;
          }),
          yCollab(text, null, { undoManager: undo }),
          EditorView.theme({
            "&": { minHeight: "10rem", fontSize: "1rem" },
            ".cm-content": {
              minHeight: "10rem",
              padding: "0.75rem",
              fontFamily: "var(--font-serif)",
              lineHeight: "1.6",
            },
            "&.cm-focused": {
              outline: "2px solid #476956",
              outlineOffset: "2px",
            },
          }),
        ],
      }),
    });
    return () => {
      editor.current = null;
      view.destroy();
      text.unobserve(changed);
      undo.destroy();
      doc.destroy();
    };
  }, []);
  useEffect(() => {
    const session = editor.current;
    if (!session || session.text.toString() === value) return;
    session.undo.stopCapturing();
    session.doc.transact(() => {
      session.text.delete(0, session.text.length);
      session.text.insert(0, value);
    });
    session.undo.stopCapturing();
  }, [value]);
  return (
    <div className="scales-yjs-editor">
      <div role="toolbar" aria-label="Sculpture text history">
        <button
          type="button"
          disabled={!history.undo}
          onClick={() => editor.current?.undo.undo()}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!history.redo}
          onClick={() => editor.current?.undo.redo()}
        >
          Redo
        </button>
      </div>
      <div ref={host} />
      {limit && <p role="status">Keep the poem within 20,000 characters.</p>}
    </div>
  );
}
