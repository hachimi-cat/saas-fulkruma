import type { SVGProps } from 'react';

/**
 * Fulkruma brand mark — a stacked-pallet glyph in Twilio red.
 * Reads as both an "F" (top crossbar + stem) and a stack of crates
 * (three horizontal bars + a base shadow), nodding to fulfilment.
 */
export function LogoMark({ size = 28, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      aria-hidden
      {...props}
    >
      <rect width="32" height="32" rx="8" fill="#F22F46" />
      {/* top crate */}
      <rect x="8" y="7"  width="16" height="4.5" rx="1.25" fill="#FFFFFF" />
      {/* middle crate (slightly narrower — gives the F a spine + step) */}
      <rect x="8" y="13.75" width="11" height="4.5" rx="1.25" fill="#FFFFFF" />
      {/* base bar (stem) */}
      <rect x="8" y="20.5" width="4.5" height="4.5" rx="1.25" fill="#FFFFFF" />
    </svg>
  );
}

export function LogoLockup({
  size = 28,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="text-base font-semibold tracking-tight">Fulkruma</span>
    </span>
  );
}
