import { useEffect, useState, type ImgHTMLAttributes } from 'react';

/** Image with a branded fallback so a dead URL never breaks the layout. */
export default function Img({ src, alt = '', className = '', ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed || !src) {
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 ${className}`}>
        <span className="font-display text-2xl font-bold tracking-[0.3em] text-white/25">VORTEX</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} {...rest} />;
}
