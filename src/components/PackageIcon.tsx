/**
 * Deterministic monogram for a package. winget exposes no icon URLs, and the
 * CSP forbids loading remote images, so identity comes from a stable hue
 * derived from the package id.
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
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  const letter = (name || id).trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className="pkg-icon"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hash} 62% 52%), hsl(${(hash + 40) % 360} 62% 42%))`,
      }}
    >
      {letter}
    </span>
  );
}
