import { Link } from 'wouter';

type BrandProps = { iconOnly?: boolean; light?: boolean; className?: string; href?: string };

export function BrandMark({ iconOnly = false, light = false, className = '', href = '/' }: BrandProps) {
  const mark = (
    <span className={`brand-lockup ${light ? 'brand-light' : ''} ${className}`}>
      <svg className="brand-symbol" viewBox="0 0 48 48" role="img" aria-label="Acadéon">
        <path d="M24 4.5 42 14.7v18.6L24 43.5 6 33.3V14.7L24 4.5Z" fill="currentColor" opacity=".12" />
        <path d="M14.2 31.7 24 13l9.8 18.7M18.2 25.1h11.6M10.5 36.5h27" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 4.5v8.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
      {!iconOnly && <span className="brand-word">Acadéon<span className="brand-dot">.</span></span>}
    </span>
  );
  if (href === '') return mark;
  return <Link href={href} className="brand-link" aria-label="Acadéon, accueil">{mark}</Link>;
}
