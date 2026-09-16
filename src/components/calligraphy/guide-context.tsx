/**
 * Which wording's brief the calligraphy components render. Without a provider
 * they render the canonical build, which keeps server rendering and the tests
 * on the canonical poem.
 */
import { createContext, type ReactNode, useContext } from "react";
import {
  CANONICAL_GUIDE,
  type CalligraphyGuide,
} from "../../../shared/calligraphy-guide";

const GuideContext = createContext<CalligraphyGuide>(CANONICAL_GUIDE);

export function GuideProvider({
  guide,
  children,
}: {
  guide: CalligraphyGuide;
  children?: ReactNode;
}) {
  return (
    <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>
  );
}

export function useGuide() {
  return useContext(GuideContext);
}
