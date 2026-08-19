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

/**
 * The stacked-crates mark as a bare ICON — no tile, `currentColor`
 * strokes — for slots that supply their own fill and expect a
 * lucide-weight glyph (the docked assistant's brand circle:
 * `bg-primary text-primary-foreground [&_svg]:h-4 [&_svg]:w-4`).
 * Dropping the tile in there paints its own #F22F46 rect over a circle
 * already filled with `--primary` (351 88% 57% → rgb 242 49 78, versus
 * the rect's 242 47 70): the tile does not read as a tile, it just
 * disappears, and what is left is the three white bars floating at
 * roughly half the optical size of the sibling lucide marks — the tile
 * reserves a quarter of its 32-box as padding, which an icon slot does
 * not want.
 *
 * So: the same three crates — full, stepped, stem, in the tile's own
 * 16 : 11 : 4.5 width ratio — redrawn as strokes that FILL lucide's
 * 24-box at lucide's weight. Rendered in the brand circle at 32/16 and
 * 40/20 beside lucide's Zap (the sibling in storlaunch's dock) and
 * beside AlignLeft, which the staircase has to stay distinct from:
 * /root/scratch/dock-chrome/fulkruma/shots/glyph-mock.png, 2026-08-19.
 * The first draft kept the tile's inner coordinates (x 6..18) and read
 * a size smaller than Zap; these fill the box the way Zap does.
 */
export function LogoGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      {/* top crate — full width */}
      <path d="M3.5 6h17" />
      {/* middle crate — the step that gives the F its spine */}
      <path d="M3.5 12h11.7" />
      {/* base bar — the stem */}
      <path d="M3.5 18h4.8" />
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
