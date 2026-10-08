/** Manufacturer guidance; sample ratios are experiments, not colour predictions. */
export const CALLIGRAPHY_INK_TIPS = [
  {
    id: "colour",
    title: "Mix a colour you can repeat",
    text: "Winsor & Newton Drawing Ink colours are intermixable within that range. In a separate cup, try two measured parts of one colour to one part of another. Label the colours and ratio, then let a swatch dry before adjusting. This is a test recipe; the screen cannot predict pigment colour.",
    source:
      "https://uk.winsornewton.com/products/drawing-ink-liquid-indian-ink",
    sourceLabel: "Winsor & Newton · Drawing Ink",
  },
  {
    id: "metallic",
    title: "Gold and silver need a light touch",
    text: "For Winsor & Newton Drawing Inks, add gold or silver only in small amounts to avoid thickening. Do not store mixtures containing their gold or silver inks: the manufacturer warns of an adverse reaction. Mix only what you need for the session.",
    source:
      "https://uk.winsornewton.com/products/drawing-ink-liquid-indian-ink",
    sourceLabel: "Winsor & Newton · Metallic mixing guidance",
  },
  {
    id: "dilution",
    title: "Lighter washes, less opacity",
    text: "Daler-Rowney FW Acrylic Inks can be intermixed within the range and diluted to subtle, watercolour-like tones. Start with a small sample and add water gradually. A lighter wash may show more of the paper beneath it; test fine strokes and a broad downstroke on your actual surface before using the mixture.",
    source: "https://daler-rowney.com/product/fw-acrylic-ink/",
    sourceLabel: "Daler-Rowney · FW Acrylic Ink",
  },
  {
    id: "binder",
    title: "Gum arabic changes flow and drying",
    text: "For watercolour or gouache mixtures, gum arabic controls flow, slows drying, and increases gloss and transparency. Try a small amount of the recommended medium in a separate sample. More binder is not automatically better. Keep this advice with watercolour and gouache; follow the bottle for other ink formulations.",
    source:
      "https://www.winsornewton.com/products/watercolour-medium-gum-arabic",
    sourceLabel: "Winsor & Newton · Gum Arabic",
  },
  {
    id: "surface",
    title: "Test the paper, then keep the recipe",
    text: "FW Acrylic Ink dries to a water-resistant film; its maker recommends preparing and testing the surface. Use your selected paper and nib for the test. Check dry colour, fine strokes, pooling and the back of the sheet. Save the recipe and dry-time observations in Materials notes. Vellum, smooth paper and printer paper can behave differently.",
    source: "https://daler-rowney.com/product/fw-acrylic-ink/",
    sourceLabel: "Daler-Rowney · Surface testing",
  },
] as const;
