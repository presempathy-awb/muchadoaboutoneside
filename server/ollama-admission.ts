export interface OllamaAdmission {
  tryAcquire(): (() => void) | undefined;
}

/** Admit at most one Ollama-backed workload at a time. */
export function createOllamaAdmission(): OllamaAdmission {
  let busy = false;
  return {
    tryAcquire() {
      if (busy) return undefined;
      busy = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        busy = false;
      };
    },
  };
}
