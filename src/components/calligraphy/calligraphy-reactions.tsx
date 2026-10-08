import type { ReactElement } from "react";
import type { CalligraphyHelpContext } from "../../lib/calligraphy-help";
import {
  CALLIGRAPHY_REPLY_REACTIONS,
  type CalligraphyReaction,
  calligraphyReactions,
} from "../../lib/calligraphy-reactions";

/** Keep contextual prompt choices inside the chat's existing scrolling area. */
export function CalligraphyReactions({
  context,
  available,
  hasReply,
  disabled,
  onReact,
}: {
  context: CalligraphyHelpContext;
  available: boolean;
  hasReply: boolean;
  disabled: boolean;
  onReact: (reaction: CalligraphyReaction) => void;
}): ReactElement {
  function choices(reactions: readonly CalligraphyReaction[]) {
    return reactions.map((reaction) => (
      <button
        className="ck-reaction-choice"
        key={reaction.label}
        type="button"
        disabled={disabled}
        onClick={() => onReact(reaction)}
      >
        {reaction.label}
      </button>
    ));
  }
  return (
    <aside className="ck-reactions" aria-label="Studio reactions">
      <strong>{available ? "Get Qwen’s take" : "Try local guidance"}</strong>
      <p className="ck-reaction-description">
        {context.title} · Choose a reaction, then decide what to change.
      </p>
      <div className="ck-help-followups">
        {choices(calligraphyReactions(context.tool))}
      </div>
      {hasReply && (
        <details>
          <summary>More ways to respond</summary>
          <div className="ck-help-followups">
            {choices(CALLIGRAPHY_REPLY_REACTIONS)}
          </div>
        </details>
      )}
    </aside>
  );
}
