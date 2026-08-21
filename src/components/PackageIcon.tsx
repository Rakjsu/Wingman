/**
 * Deterministic monogram for a package. winget exposes no icon URLs and the CSP
 * forbids remote images, so identity comes from a stable hue derived from the
 * package id.
 *
 * The hue and size travel as CSS custom properties rather than a full inline
 * `background`, which keeps the actual gradient in the stylesheet.
 */
export function PackageIcon({
  name,
  id,
  size = 36,
}: {
  name: string;
  id: string;
  size?: number;
}) {
  let hue = 0;
  for (let i = 0; i < id.length; i++) {
    hue = (hue * 31 + id.charCodeAt(i)) % 360;
  }
  const letter = (name || id).trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className="pkg-icon"
      aria-hidden="true"
      style={
        {
          "--icon-hue": hue,
          "--icon-size": `${size}px`,
        } as React.CSSProperties
      }
    >
      {letter}
    </span>
  );
}
