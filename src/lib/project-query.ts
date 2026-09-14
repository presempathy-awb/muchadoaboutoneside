import { useQuery } from "@tanstack/react-query";
import type { Project } from "../../shared/project";

export function useProject() {
  return useQuery({
    queryKey: ["project"],
    queryFn: async ({ signal }): Promise<Project> => {
      const response = await fetch("/api/project", { signal });
      if (!response.ok)
        throw new Error(`Project service returned ${response.status}`);
      return response.json();
    },
  });
}

export function formatBytes(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function materialLabel(code: string) {
  const labels: Record<string, string> = {
    ply: "Plywood",
    lath: "Lath stringers",
    beam: "Timber spine",
    eye: "Eye detail",
    fang: "Fang detail",
    base: "Wood base",
  };
  return labels[code] ?? code;
}
export function formatInches(value: number) {
  const rounded = Math.round(value);
  return `${Math.floor(rounded / 12)}′ ${rounded % 12}″`;
}
