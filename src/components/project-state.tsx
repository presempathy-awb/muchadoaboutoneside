import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProjectState({
  error,
  retry,
}: {
  error?: boolean;
  retry?: () => void;
}) {
  return (
    <div className="empty-state" role={error ? "alert" : "status"}>
      <span className="loading-mark">∞</span>
      <h1>{error ? "The workshop is unavailable" : "Opening the workshop"}</h1>
      <p>
        {error
          ? "The project service couldn’t be reached. Try again in a moment."
          : "Preparing the sculpture and its source files…"}
      </p>
      {error && (
        <Button onClick={retry} variant="outline">
          <RefreshCw size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}
