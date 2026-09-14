import type { Project } from "../shared/project";

export const project: Project = {
  name: "Much Ado About One Side",
  description: "A full-scale figure-eight snake sculpture construction model.",
  model: {
    heightInches: 206.3,
    widthInches: 171,
    depthInches: 171,
    triangles: 13_876,
    parts: [
      {
        id: "ribs",
        label: "Ribs",
        material: "ply",
        color: "#dcc48c",
        triangles: 5_632,
      },
      {
        id: "slats",
        label: "Slats",
        material: "lath",
        color: "#c9a468",
        triangles: 5_436,
      },
      {
        id: "spine",
        label: "Spine",
        material: "beam",
        color: "#8f6a42",
        triangles: 360,
      },
      {
        id: "head",
        label: "Head",
        material: "ply",
        color: "#dcc48c",
        triangles: 2_176,
      },
      {
        id: "eyes",
        label: "Eyes",
        material: "eye",
        color: "#241b16",
        triangles: 192,
      },
      {
        id: "fangs",
        label: "Fangs",
        material: "fang",
        color: "#f0e8d6",
        triangles: 16,
      },
      {
        id: "base",
        label: "Base",
        material: "base",
        color: "#cdb27f",
        triangles: 64,
      },
    ],
  },
  assets: [
    {
      name: "snake_build.glb",
      format: "GLB",
      bytes: 302_520,
      sha256:
        "81167fb7416443e21aab53379e7f6a2d5b43493b9f811829313e7f31e2555150",
      url: "/api/assets/snake_build.glb",
    },
    {
      name: "snake_build.obj",
      format: "OBJ",
      bytes: 422_696,
      sha256:
        "776e6563a29d3ac0f0b8d4a03c9927af7c1dceacf0b77008db497bc08483a5d6",
      url: "/api/assets/snake_build.obj",
    },
    {
      name: "snake_build.stl",
      format: "STL",
      bytes: 693_884,
      sha256:
        "08840b84c9a963c650c13d3a004e792ddcc0850321ede8986a180a86942a75d3",
      url: "/api/assets/snake_build.stl",
    },
    {
      name: "snake_build_viewer.html",
      format: "HTML",
      bytes: 343_578,
      sha256:
        "694dc1c4ab7c9db05a6ed316551c59cc3b49165e36eced673f2e26c6e7805df9",
      url: "/api/assets/snake_build_viewer.html",
    },
  ],
  source: {
    url: "https://claude.ai/share/f424ef86-dcac-4e63-aecb-a017ed781b5b",
    conversationImported: false,
    status:
      "Model assets supplied from Downloads; Claude conversation remains unavailable behind browser verification.",
  },
};

export const assetNames = new Set(project.assets.map(({ name }) => name));
