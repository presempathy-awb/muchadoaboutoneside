import type {
  CalligraphyRequirements,
  CalligraphySettingsSuggestion,
} from "./calligraphy-settings";
import type { WorksheetSettings } from "./worksheet";

export interface CalligraphyMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CalligraphySource {
  id: string;
  title: string;
  url: string;
  kind: "library" | "web";
}

export interface CalligraphyAssistantCapability {
  available: boolean;
  models: string[];
  webSearch: boolean;
  transport: "ollama";
}

export interface CalligraphyAssistantRequest {
  kind: "chat" | "settings";
  question: string;
  model: string;
  web: boolean;
  history: CalligraphyMessage[];
  settings?: WorksheetSettings;
  requirements?: CalligraphyRequirements;
}

export interface CalligraphyAssistantReply {
  answer: string;
  model: string;
  sources: CalligraphySource[];
  warnings: string[];
  searched: boolean;
  proposal?: CalligraphySettingsSuggestion;
}
