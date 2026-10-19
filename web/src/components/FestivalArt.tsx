import type { FestivalDecor, FestivalMotif } from '@engine';
import type { ReactElement } from 'react';

/**
 * Generated festival artwork (inline SVG, no image files to manage). The
 * admin can replace any of it with an uploaded image in the festival editor.
 */
export function Motif({ motif, size = 96, className }: { motif: FestivalMotif; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {MOTIFS[motif] ?? MOTIFS.sparkle}
    </svg>
  );
}

const petals = (n: number, r: number, rx: number, ry: number, fill: string, rot = 0) =>
  Array.from({ length: n }, (_, i) => (
    <ellipse key={`${fill}${i}`} cx="50" cy={50 - r} rx={rx} ry={ry} fill={fill} transform={`rotate(${rot + (360 / n) * i} 50 50)`} />
  ));

const MOTIFS: Record<FestivalMotif, ReactElement> = {
  diya: (
    <g>
      <ellipse cx="50" cy="40" rx="9" ry="16" fill="#FDE68A" opacity=".55" className="flicker" />
      <path d="M50 22c6 9 7 15 0 22-7-7-6-13 0-22z" fill="#F59E0B" className="flicker" />
      <path d="M50 30c3 5 3 8 0 12-3-4-3-7 0-12z" fill="#FEF3C7" />
      <path d="M14 52h72c-4 18-18 28-36 28S18 70 14 52z" fill="#B45309" />
      <path d="M14 52h72c-1 4-3 7-5 10H19c-2-3-4-6-5-10z" fill="#D97706" />
      <circle cx="30" cy="66" r="3" fill="#FDE68A" /><circle cx="50" cy="70" r="3" fill="#FDE68A" /><circle cx="70" cy="66" r="3" fill="#FDE68A" />
    </g>
  ),
  rangoli: (
    <g>
      {petals(8, 26, 8, 16, '#EC4899')}
      {petals(8, 20, 6, 12, '#F59E0B', 22.5)}
      {petals(8, 12, 4, 8, '#22C55E')}
      <circle cx="50" cy="50" r="7" fill="#3B82F6" /><circle cx="50" cy="50" r="3" fill="#FFF" />
    </g>
  ),
  colors: (
    <g>
      <circle cx="30" cy="36" r="18" fill="#EC4899" opacity=".85" /><circle cx="64" cy="30" r="14" fill="#F59E0B" opacity=".85" />
      <circle cx="68" cy="64" r="20" fill="#22C55E" opacity=".8" /><circle cx="36" cy="70" r="13" fill="#3B82F6" opacity=".85" />
      <circle cx="50" cy="50" r="9" fill="#8B5CF6" opacity=".9" />
      <circle cx="16" cy="58" r="4" fill="#F59E0B" /><circle cx="86" cy="40" r="5" fill="#EC4899" /><circle cx="54" cy="12" r="4" fill="#3B82F6" />
    </g>
  ),
  crescent: (
    <g>
      <path d="M58 14a34 34 0 1 0 22 58A28 28 0 1 1 58 14z" fill="#FDE68A" />
      <path d="M74 22l2.6 6.4 6.9.4-5.3 4.4 1.7 6.7L74 36.3l-5.9 3.6 1.7-6.7-5.3-4.4 6.9-.4z" fill="#FDE68A" />
      <g transform="translate(30 50)">
        <path d="M10 0v8" stroke="#D4A017" strokeWidth="2" />
        <path d="M2 8h16l-3 6H5z" fill="#D4A017" /><rect x="3" y="14" width="14" height="18" rx="3" fill="#F59E0B" opacity=".9" />
        <rect x="7" y="18" width="6" height="10" rx="3" fill="#FEF3C7" className="flicker" /><path d="M3 32h14l-3 4H6z" fill="#D4A017" />
      </g>
    </g>
  ),
  star: (
    <g>
      <path d="M50 8l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="#FACC15" />
      <path d="M50 30L22 82h56z" fill="#15803D" /><path d="M50 30L30 66h40z" fill="#16A34A" />
      <rect x="45" y="82" width="10" height="10" fill="#7C2D12" />
      <circle cx="40" cy="60" r="3" fill="#EF4444" /><circle cx="60" cy="70" r="3" fill="#FACC15" /><circle cx="52" cy="50" r="3" fill="#60A5FA" /><circle cx="36" cy="76" r="3" fill="#FACC15" /><circle cx="66" cy="78" r="3" fill="#EF4444" />
    </g>
  ),
  kite: (
    <g>
      <path d="M50 8L78 40 50 72 22 40z" fill="#F59E0B" /><path d="M50 8v64M22 40h56" stroke="#B45309" strokeWidth="1.5" />
      <path d="M50 8L78 40H50z" fill="#EF4444" /><path d="M50 72L22 40h28z" fill="#22C55E" />
      <path d="M50 72c-6 6 6 10 0 16s6 8 2 12" stroke="#B45309" strokeWidth="1.5" fill="none" />
      <path d="M46 80l-6-2 2 5zM50 90l6 1-4 4z" fill="#EF4444" />
    </g>
  ),
  pookalam: (
    <g>
      <circle cx="50" cy="50" r="40" fill="#EAB308" /><circle cx="50" cy="50" r="33" fill="#F97316" />
      {petals(12, 22, 6, 10, '#FEF3C7')}
      <circle cx="50" cy="50" r="16" fill="#DC2626" />{petals(6, 8, 4, 6, '#FDE68A')}
      <circle cx="50" cy="50" r="4" fill="#15803D" />
    </g>
  ),
  tricolor: (
    <g>
      <path d="M14 22c18-6 36 6 72 0v18c-36 6-54-6-72 0z" fill="#FF9933" />
      <path d="M14 40c18-6 36 6 72 0v18c-36 6-54-6-72 0z" fill="#FFFFFF" stroke="#E5E7EB" />
      <path d="M14 58c18-6 36 6 72 0v18c-36 6-54-6-72 0z" fill="#138808" />
      <circle cx="50" cy="49" r="6.5" fill="none" stroke="#000080" strokeWidth="1.6" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d="M50 49v-6" stroke="#000080" strokeWidth=".8" transform={`rotate(${i * 30} 50 49)`} />)}
      <rect x="11" y="18" width="3" height="76" fill="#6B7280" />
    </g>
  ),
  rakhi: (
    <g>
      <path d="M4 52c20-6 30 2 46-2s28-8 46 0" stroke="#DC2626" strokeWidth="3" fill="none" />
      <path d="M4 56c20-6 30 2 46-2s28-8 46 0" stroke="#FACC15" strokeWidth="2" fill="none" />
      {petals(10, 16, 6, 9, '#EC4899')}<circle cx="50" cy="50" r="12" fill="#FACC15" /><circle cx="50" cy="50" r="6" fill="#DC2626" />
    </g>
  ),
  dandiya: (
    <g>
      <rect x="47" y="8" width="7" height="86" rx="3" fill="#B45309" transform="rotate(-28 50 50)" />
      <rect x="47" y="8" width="7" height="86" rx="3" fill="#D97706" transform="rotate(28 50 50)" />
      <g transform="rotate(-28 50 50)"><rect x="46" y="20" width="9" height="5" fill="#EC4899" /><rect x="46" y="70" width="9" height="5" fill="#22C55E" /></g>
      <g transform="rotate(28 50 50)"><rect x="46" y="20" width="9" height="5" fill="#3B82F6" /><rect x="46" y="70" width="9" height="5" fill="#FACC15" /></g>
      <circle cx="50" cy="50" r="5" fill="#FDE68A" />
    </g>
  ),
  lotus: (
    <g>
      <path d="M50 20c10 14 10 32 0 46-10-14-10-32 0-46z" fill="#F472B6" />
      <path d="M50 66C38 60 26 48 24 32c14 4 24 18 26 34z" fill="#EC4899" /><path d="M50 66c12-6 24-18 26-34-14 4-24 18-26 34z" fill="#EC4899" />
      <path d="M50 68C36 68 20 60 12 48c16-2 30 6 38 20z" fill="#DB2777" /><path d="M50 68c14 0 30-8 38-20-16-2-30 6-38 20z" fill="#DB2777" />
      <path d="M20 74h60" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  bow: (
    <g>
      <path d="M28 12c30 14 30 62 0 76" stroke="#7C2D12" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M28 12v76" stroke="#FDE68A" strokeWidth="1.5" />
      <path d="M22 50h66" stroke="#B45309" strokeWidth="3" /><path d="M92 50l-10-6v12z" fill="#DC2626" />
      <path d="M22 50l-6-5M22 50l-6 5" stroke="#F59E0B" strokeWidth="2" />
    </g>
  ),
  sparkle: (
    <g fill="#FDE68A">
      <path d="M50 10l6 30 30 10-30 10-6 30-6-30-30-10 30-10z" />
      <path d="M82 14l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" opacity=".8" /><path d="M20 72l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" opacity=".8" />
    </g>
  ),
};

/** Thin decoration strip under the header / above the footer. */
export function DecorStrip({ decor }: { decor: FestivalDecor }) {
  if (decor === 'none') return null;
  if (decor === 'tricolor') {
    return (
      <div className="decor decor-tricolor" aria-hidden="true">
        <span style={{ background: '#FF9933' }} /><span style={{ background: '#FFFFFF' }} /><span style={{ background: '#138808' }} />
      </div>
    );
  }
  const id = `decor-${decor}`;
  return (
    <svg className={`decor decor-${decor}`} width="100%" height="22" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="48" height="22" patternUnits="userSpaceOnUse">{PATTERNS[decor]}</pattern>
      </defs>
      <rect width="100%" height="22" fill={`url(#${id})`} />
    </svg>
  );
}

const PATTERNS: Record<Exclude<FestivalDecor, 'none' | 'tricolor'>, ReactElement> = {
  toran: (
    <g>
      <path d="M0 2q24 14 48 0" stroke="#15803D" strokeWidth="1.5" fill="none" />
      <circle cx="8" cy="6" r="3.2" fill="#F97316" /><circle cx="16" cy="8.5" r="3.2" fill="#FACC15" /><circle cx="24" cy="9" r="3.2" fill="#F97316" />
      <circle cx="32" cy="8.5" r="3.2" fill="#FACC15" /><circle cx="40" cy="6" r="3.2" fill="#F97316" />
      <path d="M24 12l-3 9 3-2 3 2z" fill="#16A34A" />
    </g>
  ),
  lights: (
    <g>
      <path d="M0 3q24 8 48 0" stroke="#78716C" strokeWidth="1" fill="none" />
      <g className="twinkle"><ellipse cx="12" cy="11" rx="3.4" ry="5" fill="#FACC15" /><ellipse cx="36" cy="11" rx="3.4" ry="5" fill="#F472B6" /></g>
      <g className="twinkle delay"><ellipse cx="24" cy="13" rx="3.4" ry="5" fill="#60A5FA" /><ellipse cx="0" cy="7" rx="3.4" ry="5" fill="#4ADE80" /><ellipse cx="48" cy="7" rx="3.4" ry="5" fill="#4ADE80" /></g>
    </g>
  ),
  bunting: (
    <g>
      <path d="M0 2h48" stroke="#78716C" strokeWidth="1" />
      <path d="M2 2h12l-6 14z" fill="#EC4899" /><path d="M18 2h12l-6 14z" fill="#FACC15" /><path d="M34 2h12l-6 14z" fill="#22C55E" />
    </g>
  ),
};
