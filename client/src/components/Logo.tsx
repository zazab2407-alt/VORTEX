import { Link } from 'react-router-dom';

export default function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" aria-label="VORTEX home" className={`flex items-center font-display text-3xl font-extrabold tracking-[0.12em] ${light ? 'text-white' : 'text-neutral-950'}`}>
      VORTE<span className="relative inline-block text-brand">X<span className="absolute -right-1 top-1 h-2 w-2 -skew-x-12 bg-brand" /></span>
    </Link>
  );
}
