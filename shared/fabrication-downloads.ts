// Content versions prevent a previous deployment's archive being served from cache.
// The integrity test requires these versions to match the downloadable files.
export const FABRICATION_DOWNLOADS = {
  largeKit:
    "/fabrication/laser/panel-kit.zip?v=4a13f29f1c91892be9cc806df0e584ede1aa2ce3536ab9253e7114a4dc74d368",
  largeFitKit:
    "/fabrication/laser/representative-fit-kit.zip?v=f2a37ae1a21ec638dc000264bf3356da55614348032ab09505a03ad0f997cba7",
  smallKit:
    "/fabrication/small-foil/foil-kit-180mm.zip?v=3a5b2613bd9823fb748a60b5ae9dea15453117d4ae80d58265191af7b90b5bff",
} as const;
