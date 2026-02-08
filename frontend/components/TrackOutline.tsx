// Minimal circuit-style outline SVGs (abstract shapes for variety per track)
const VARIANTS = [
  <ellipse key="0" cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  <path key="1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M4 8h6v8H4V8zm10 0h6v8h-6V8zM8 12h8" />,
  <path key="2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 4v16M4 12h16M6 6l12 12M18 6L6 18" />,
  <path key="3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z" />,
];

export default function TrackOutline({
  variant = 0,
  className = '',
}: {
  variant?: number;
  className?: string;
}) {
  const index = Math.abs(variant) % VARIANTS.length;
  return (
    <svg
      className={`text-white/40 ${className}`}
      viewBox="0 0 24 24"
      width="48"
      height="32"
      aria-hidden
    >
      {VARIANTS[index]}
    </svg>
  );
}
