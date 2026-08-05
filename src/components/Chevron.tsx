export default function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 80" className={className} aria-hidden="true">
      <polyline points="46,10 18,40 46,70" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      <polyline points="34,10 6,40 34,70" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
