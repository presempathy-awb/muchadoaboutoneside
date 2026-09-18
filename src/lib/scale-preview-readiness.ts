interface ScalePreviewInputs {
  text: string;
  showLettering: boolean;
  hasGeometry: boolean;
  geometryPending: boolean;
  geometryError: string;
  layoutPending: boolean;
  hasTypography: boolean;
  fontError: string;
  layoutError: string;
}

/** Blank or explicitly unlettered shapes can display without font resources. */
export function scalePreviewReadiness(input: ScalePreviewInputs) {
  const requiresTypography = input.showLettering && /\S/u.test(input.text);
  const pending =
    input.geometryPending ||
    input.layoutPending ||
    (requiresTypography && !input.hasTypography && !input.fontError);
  const blocked = Boolean(
    input.geometryError ||
      (requiresTypography && (input.fontError || input.layoutError)),
  );
  return {
    requiresTypography,
    pending,
    blocked,
    ready:
      input.hasGeometry &&
      !pending &&
      !blocked &&
      (!requiresTypography || input.hasTypography),
  };
}
