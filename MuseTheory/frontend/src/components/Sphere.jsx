export function Spark({ className = '', inline = false, size = 22 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={inline ? className : `spark ${className}`}
      fill="currentColor"
      aria-hidden="true"
      width={inline ? size : undefined}
      height={inline ? size : undefined}
      style={inline ? { display: 'inline-block', flexShrink: 0 } : undefined}
    >
      <path d="M12 0 L13.4 8.6 L22 10 L13.4 11.4 L12 22 L10.6 11.4 L0 10 L10.6 8.6 Z" />
    </svg>
  );
}

export function Sphere({ orbit = true, rings = true, sparks = true }) {
  return (
    <div className="hero-sphere-wrap">
      <div className="sphere" />
      {orbit && <div className="sphere-orbit" />}
      {rings && <div className="sphere-ring" />}
      {sparks && (
        <>
          <Spark className="spark-a" />
          <Spark className="spark-b" />
          <Spark className="spark-c" />
          <Spark className="spark-d" />
        </>
      )}
    </div>
  );
}

export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="nav-brand-mark" fill="none" aria-hidden="true">
      <path
        d="M4 16 C 4 8, 12 4, 16 12 C 20 4, 28 8, 28 16 C 28 24, 20 28, 16 20 C 12 28, 4 24, 4 16 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
      />
    </svg>
  );
}
