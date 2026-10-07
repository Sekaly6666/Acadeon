import { Link } from 'wouter';

type BrandProps = { iconOnly?: boolean; light?: boolean; className?: string; href?: string };

export function BrandMark({ iconOnly = false, light = false, className = '', href = '/' }: BrandProps) {
  const mark = (
    <span className={`brand-lockup ${light ? 'brand-light' : ''} ${className}`}>
      <svg className="brand-symbol" viewBox="0 0 48 48" role="img" aria-label="Acadéon">
        <defs>
          <linearGradient id={`acadGrad-${light ? 'light' : 'dark'}`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={light ? "#38BDF8" : "#1E3A5F"} />
            <stop offset="100%" stopColor={light ? "#1E3A5F" : "#0F2438"} />
          </linearGradient>
          <linearGradient id={`acadEmGrad-${light ? 'light' : 'dark'}`} x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Squircle Background Base */}
        <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#acadGrad-${light ? 'light' : 'dark'})`} />
        <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#FFFFFF" strokeOpacity={light ? "0.28" : "0.15"} />

        {/* Open Book Pages Base */}
        <path d="M11 34 C16 31.5 22 32.5 24 34 C26 32.5 32 31.5 37 34" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 37 C17 34.5 22 35.5 24 36.8 C26 35.5 31 34.5 36 37" stroke={`url(#acadEmGrad-${light ? 'light' : 'dark'})`} strokeWidth="1.8" strokeLinecap="round" />

        {/* Architectural Monogram 'A' */}
        <path d="M14 31 L24 13 L34 31" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Mortarboard Graduation Diamond */}
        <path d="M16 23 L24 19 L32 23 L24 27 Z" fill={`url(#acadEmGrad-${light ? 'light' : 'dark'})`} stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />

        {/* Golden Guiding Star Beacon */}
        <polygon points="24,8.5 25.3,11.5 28.5,12 26.2,14.2 26.8,17.4 24,15.8 21.2,17.4 21.8,14.2 19.5,12 22.7,11.5" fill="#FBBF24" />
      </svg>
      {!iconOnly && <span className="brand-word">Acadéon<span className="brand-dot">.</span></span>}
    </span>
  );
  if (href === '') return mark;
  return <Link href={href} className="brand-link" aria-label="Acadéon, accueil">{mark}</Link>;
}
