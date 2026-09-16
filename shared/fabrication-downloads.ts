// Content versions prevent a previous deployment's artwork being served from cache.
// The integrity test requires these versions to match the downloadable files.
export const FABRICATION_DOWNLOADS = {
  bodyMaster:
    "/fabrication/laser/marking-master.svg?v=b597cbdd1f63fa407de65dd57225d420510c7c13eacae95b5ad70d0c82f8c23e",
  jawMaster:
    "/fabrication/laser/jaw-marking-master.svg?v=91b54311d0a7e6447a8c96d2211b21dc515e2c4239370b5001272237d1ea7e35",
  smallModel:
    "/fabrication/small-foil/muchado-foil-180mm.glb?v=de054d5f7672867dfd38117d467be01f1dbd05d314af4ad5d7696d8d65155f37",
  largeKit:
    "/fabrication/laser/panel-kit.zip?v=0a253226337f873b23fd82ac9a43844e39f2dbc516a8b2a1a0fce2f38d66184e",
  largeFitKit:
    "/fabrication/laser/representative-fit-kit.zip?v=b50ec04c554488bc7649ae44ce263170191ea082a1f55e4ec753039239d2e7a4",
  smallKit:
    "/fabrication/small-foil/foil-kit-180mm.zip?v=ab69099f9f614deea28edba126df0f069e663b09b7d58bb0c53c61494ccc984a",
} as const;
