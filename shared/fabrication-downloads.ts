// Content versions prevent a previous deployment's artwork being served from cache.
// The integrity test requires these versions to match the downloadable files.
export const FABRICATION_DOWNLOADS = {
  bodyMaster:
    "/fabrication/laser/marking-master.svg?v=b597cbdd1f63fa407de65dd57225d420510c7c13eacae95b5ad70d0c82f8c23e",
  jawMaster:
    "/fabrication/laser/jaw-marking-master.svg?v=91b54311d0a7e6447a8c96d2211b21dc515e2c4239370b5001272237d1ea7e35",
  smallModel:
    "/fabrication/small-foil/muchado-foil-180mm.glb?v=8d285421e50b63f8597183eb07378a65d2b2acfc58aefb1b81d20db0de00210c",
  largeKit:
    "/fabrication/laser/panel-kit.zip?v=0a253226337f873b23fd82ac9a43844e39f2dbc516a8b2a1a0fce2f38d66184e",
  largeFitKit:
    "/fabrication/laser/representative-fit-kit.zip?v=b50ec04c554488bc7649ae44ce263170191ea082a1f55e4ec753039239d2e7a4",
  smallKit:
    "/fabrication/small-foil/foil-kit-180mm.zip?v=9d99556ff16a270cd652e0a79ca71421394e6b156c155a502ecc9af135ea1f71",
} as const;
