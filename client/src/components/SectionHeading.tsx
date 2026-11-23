import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface Props { eyebrow?: string; title: string; linkTo?: string; linkLabel?: string; light?: boolean; center?: boolean }
export default function SectionHeading({ eyebrow, title, linkTo, linkLabel = 'View all', light, center }: Props) {
  return (
    <div className={`mb-8 flex items-end justify-between gap-4 ${center ? 'flex-col items-center text-center' : ''}`}>
      <div>
        {eyebrow && <p className="mb-1 font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">{eyebrow}</p>}
        <h2 className={`text-4xl font-extrabold leading-none sm:text-5xl ${light ? 'text-white' : 'text-neutral-950'}`}>{title}</h2>
      </div>
      {linkTo && (
        <Link to={linkTo} className={`group flex shrink-0 items-center gap-1.5 py-2 text-sm font-semibold underline-offset-4 hover:underline ${light ? 'text-white' : ''}`}>
          {linkLabel} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
