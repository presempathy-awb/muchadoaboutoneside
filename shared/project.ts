export interface ProjectPart {
  id: string;
  label: string;
  material: string;
  color: string;
  triangles: number;
}

export interface ProjectAsset {
  name: string;
  format: string;
  bytes: number;
  sha256: string;
  url: string;
}

export interface Project {
  name: string;
  description: string;
  model: {
    heightInches: number;
    widthInches: number;
    depthInches: number;
    triangles: number;
    parts: ProjectPart[];
  };
  assets: ProjectAsset[];
  source: {
    url: string;
    conversationImported: boolean;
    status: string;
  };
}
