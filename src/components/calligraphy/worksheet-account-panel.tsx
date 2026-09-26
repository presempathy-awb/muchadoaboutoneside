import { useState } from "react";
import {
  CREW_WORKSHEET_ORIGIN,
  CREW_WORKSHEET_PATH,
  type WorksheetAccountSnapshot,
} from "../../../shared/worksheet-account";
import type { WorksheetSnapshot } from "../../lib/worksheet-store";

interface WorksheetAccountPanelProps {
  ready: boolean;
  getSnapshot: () => WorksheetSnapshot;
  load: (snapshot: WorksheetSnapshot) => void;
  keepLocalCopy: (name: string) => void;
}

type AccountState =
  | { kind: "idle" }
  | { kind: "message"; text: string }
  | {
      kind: "conflict";
      revision: number;
      snapshot: WorksheetAccountSnapshot;
    };

function accountUrl() {
  if (globalThis.location?.hostname === "erebe.muchadoaboutoneside.com")
    return CREW_WORKSHEET_PATH;
  return `${CREW_WORKSHEET_ORIGIN}${CREW_WORKSHEET_PATH}`;
}

export function WorksheetAccountPanel({
  ready,
  getSnapshot,
  load,
  keepLocalCopy,
}: WorksheetAccountPanelProps) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<AccountState>({ kind: "idle" });

  async function save(baseRevision: number) {
    setBusy(true);
    try {
      const response = await fetch(accountUrl(), {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseRevision, snapshot: getSnapshot() }),
      });
      if (response.status === 401) {
        setState({
          kind: "message",
          text: "Sign in on the crew board first. This browser draft stays here.",
        });
        return;
      }
      if (response.status === 409) {
        const body = (await response.json()) as {
          revision: number;
          snapshot: WorksheetAccountSnapshot;
        };
        setState({
          kind: "conflict",
          revision: body.revision,
          snapshot: body.snapshot,
        });
        return;
      }
      if (!response.ok) {
        setState({
          kind: "message",
          text: "The crew copy was not saved.",
        });
        return;
      }
      setState({ kind: "message", text: "Saved a copy to your crew account." });
    } catch {
      setState({
        kind: "message",
        text: "The crew board could not be reached.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrent() {
    setBusy(true);
    try {
      const response = await fetch(accountUrl(), { credentials: "include" });
      if (response.status === 401) {
        setState({
          kind: "message",
          text: "Sign in on the crew board first. This browser draft stays here.",
        });
        return;
      }
      if (!response.ok) {
        setState({ kind: "message", text: "The crew copy was not saved." });
        return;
      }
      const body = (await response.json()) as { revision: number };
      setBusy(false);
      await save(body.revision);
    } catch {
      setState({
        kind: "message",
        text: "The crew board could not be reached.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-save-row">
      <p className="ws-field">
        <span>Crew account</span>
        The anonymous desk is not copied until you ask. Signing in happens on
        the crew board.
      </p>
      <a href={`${CREW_WORKSHEET_ORIGIN}/crew/`}>Open the crew board</a>
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void saveCurrent()}
      >
        Save a crew copy
      </button>
      {state.kind === "message" ? <p>{state.text}</p> : null}
      {state.kind === "conflict" ? (
        <>
          <p>The crew copy changed since this page looked.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              keepLocalCopy("Local copy before crew load");
              load(state.snapshot as WorksheetSnapshot);
              setState({ kind: "message", text: "Loaded the crew copy." });
            }}
          >
            Load the crew copy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(state.revision)}
          >
            Save mine over it
          </button>
        </>
      ) : null}
    </div>
  );
}
