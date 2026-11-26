import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Share of the element that must be on screen before it reveals (same meaning as the IntersectionObserver threshold). */
const VISIBLE_RATIO = 0.1;
/** If the element has still not been revealed after this long, check its position directly. */
const FALLBACK_DELAY_MS = 1000;

/** Animation needs a working IntersectionObserver, and is skipped for users who prefer reduced motion. */
function canAnimate() {
  if (typeof IntersectionObserver === 'undefined') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

/** Position check that does not depend on the observer: is enough of the element on screen right now? */
function onScreen(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.height <= 0) return false;
  const viewport = window.innerHeight || document.documentElement.clientHeight;
  const visible = Math.min(r.bottom, viewport) - Math.max(r.top, 0);
  return visible / r.height >= VISIBLE_RATIO;
}

export default function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // Content starts visible whenever animation is not possible, so a missing or broken observer can never hide it
  const [shown, setShown] = useState(() => !canAnimate());

  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return;

    let io: IntersectionObserver | null = null;
    let timer = 0;
    let frame = 0;
    let finished = false;

    // Removes everything this instance created: the observer, the timer, a pending frame, and the scroll/resize listeners
    const cleanup = () => {
      io?.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    const reveal = () => {
      if (finished) return;
      finished = true;
      cleanup();
      setShown(true);
    };
    const check = () => {
      frame = 0;
      if (onScreen(el)) reveal();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    try {
      io = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) reveal();
      }, { threshold: VISIBLE_RATIO });
      io.observe(el);
    } catch {
      reveal();
      return cleanup;
    }

    // Safety net. It does not rely on the observer's callbacks, so an observer that reports once and then goes silent
    // still leaves these checks running: elements already on screen are revealed after a short wait, and elements
    // the reader scrolls to are revealed by the scroll listener.
    timer = window.setTimeout(check, FALLBACK_DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return cleanup;
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}>
      {children}
    </div>
  );
}
