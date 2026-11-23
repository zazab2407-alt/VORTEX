import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Instagram, RotateCcw, ShieldCheck, Truck, Zap } from 'lucide-react';
import { productService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { GALLERY, HERO_IMAGE, MEN_BANNER, PROMO_IMAGE, WOMEN_BANNER } from '../data/images';
import { whyUs } from '../data/content';
import { useShopConfig } from '../hooks/useShopConfig';
import { freeShippingLabel, returnsLabel } from '../utils/storeText';
import type { Gender, Product } from '../types';
import ProductGrid from '../components/ProductGrid';
import SectionHeading from '../components/SectionHeading';
import Reveal from '../components/Reveal';
import Img from '../components/Img';
import ErrorState from '../components/ErrorState';

const ICONS = { zap: Zap, truck: Truck, return: RotateCcw, shield: ShieldCheck };

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100vh-7rem)] items-end overflow-hidden bg-neutral-950 text-white lg:items-center">
      <Img src={HERO_IMAGE} alt="Athlete training in VORTEX sportswear" loading="eager" className="absolute inset-0 h-full w-full animate-ken-burns object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="container-x relative py-16 lg:py-24">
        <p className="animate-fade-up font-display text-xl font-bold uppercase tracking-[0.3em] text-brand">New Season / 2026</p>
        <h1 className="mt-3 max-w-3xl animate-fade-up text-[4.5rem] font-extrabold leading-[0.88] [animation-delay:100ms] sm:text-8xl lg:text-[9rem]">
          Built to <span className="text-brand">move.</span>
        </h1>
        <p className="mt-6 max-w-md animate-fade-up text-base text-white/80 [animation-delay:200ms] sm:text-lg">
          Premium performance sportswear engineered for every rep, every mile, every limit you refuse to accept.
        </p>
        <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:300ms]">
          <Link to="/shop" className="btn btn-primary">Shop Now <ArrowRight size={20} /></Link>
          <Link to="/shop?collection=new" className="btn btn-outline-light">New Arrivals</Link>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const shop = useShopConfig();
  const items = [freeShippingLabel(shop), 'Performance fabrics', returnsLabel(shop), 'Train without limits', 'Secure checkout'];
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden bg-neutral-950 py-3 text-white" aria-hidden="true">
      <div className="flex w-max animate-marquee">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center whitespace-nowrap font-display text-xl font-bold uppercase tracking-widest">
            {t}<Zap size={16} className="mx-8 fill-brand text-brand" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Collection({ gender, title, banner, products, loading, reverse }: { gender: Gender; title: string; banner: string; products: Product[] | null; loading: boolean; reverse?: boolean }) {
  return (
    <section className="container-x py-14 lg:py-20">
      <div className={`grid gap-6 lg:grid-cols-5 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <Reveal className="lg:col-span-2">
          <Link to={`/shop?gender=${gender}`} className="group relative block h-full min-h-[420px] overflow-hidden bg-neutral-900">
            <Img src={banner} alt={title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-0 p-6 text-white sm:p-8">
              <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">Collection</p>
              <h2 className="text-5xl font-extrabold leading-none sm:text-6xl">{title}</h2>
              <span className="mt-4 inline-flex items-center gap-2 border-b-2 border-brand pb-1 font-semibold">Shop {gender === 'men' ? "men's" : "women's"} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1.5" /></span>
            </div>
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:col-span-3 sm:gap-x-6">
          <ProductGrid products={products} loading={loading} skeletons={3} cols="col-span-full grid-cols-2 sm:grid-cols-3" className="max-sm:[&>*:nth-child(n+3)]:hidden" />
        </div>
      </div>
    </section>
  );
}

function ProductSection({ eyebrow, title, products, loading, link, dark }: { eyebrow: string; title: string; products: Product[] | null; loading: boolean; link: string; dark?: boolean }) {
  return (
    <section className={dark ? 'bg-neutral-100' : ''}>
      <div className="container-x py-14 lg:py-20">
        <SectionHeading eyebrow={eyebrow} title={title} linkTo={link} />
        <ProductGrid products={products} loading={loading} />
      </div>
    </section>
  );
}

function Promo() {
  const { promoCode } = useShopConfig();
  return (
    <section className="relative overflow-hidden bg-neutral-950 py-24 text-white lg:py-32">
      <Img src={PROMO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
      <Reveal className="container-x relative">
        <p className="font-display text-xl font-bold uppercase tracking-[0.3em] text-brand">On sale now</p>
        <h2 className="mt-2 max-w-2xl text-6xl font-extrabold leading-[0.9] sm:text-8xl">Selected <span className="text-brand">gear</span> at a lower price</h2>
        {promoCode && <p className="mt-5 max-w-md text-white/80">Use code <strong className="text-white">{promoCode}</strong> at checkout.</p>}
        <Link to="/shop?collection=sale" className="btn btn-primary mt-8">Shop the Sale <ArrowRight size={20} /></Link>
      </Reveal>
    </section>
  );
}

function WhyUs() {
  const shop = useShopConfig();
  return (
    <section className="container-x py-14 lg:py-20">
      <SectionHeading eyebrow="The VORTEX difference" title="Why choose us" center />
      <div className="grid gap-px overflow-hidden border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
        {whyUs(shop).map(({ icon, title, text }, i) => {
          const Icon = ICONS[icon];
          return (
            <Reveal key={title} delay={i * 80} className="group bg-white p-8 transition-colors hover:bg-neutral-950 hover:text-white">
              <Icon size={36} className="text-brand" />
              <h3 className="mt-5 text-2xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-neutral-500 group-hover:text-neutral-300">{text}</p>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function InstagramGallery() {
  return (
    <section className="container-x py-14 lg:py-20">
      <SectionHeading eyebrow="Gallery" title="Train with VORTEX" center />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {GALLERY.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden bg-neutral-200">
            <Img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** One fetch, four sections, no product shown twice on the page. */
function useHomeSections() {
  const { data, loading, error, reload } = useAsync((s) => productService.list({ limit: 50 }, s), []);
  const sections = useMemo(() => {
    if (!data) return null;
    const used = new Set<string>();
    const take = (list: Product[], n: number) => {
      const out = list.filter((p) => !used.has(p.id)).slice(0, n);
      out.forEach((p) => used.add(p.id));
      return out;
    };
    const products = data.items;
    const bySold = [...products].sort((a, b) => b.sold - a.sold);
    const byNew = [...products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const best = take(bySold.filter((p) => p.isBestSeller), 4);
    const fresh = take(byNew.filter((p) => p.isNew), 4);
    const forGender = (g: Gender) => [...bySold.filter((p) => p.gender === g), ...bySold.filter((p) => p.gender === 'unisex')];
    const men = take(forGender('men'), 3);
    const women = take(forGender('women'), 3);
    return { best, fresh, men, women };
  }, [data]);
  return { sections, loading, error, reload };
}

export default function Home() {
  useDocumentTitle();
  const { sections: s, loading, error, reload } = useHomeSections();
  return (
    <>
      <Hero />
      <Marquee />
      {error ? (
        <section className="container-x"><ErrorState error={error} onRetry={reload} compact title="We could not load the shop" /></section>
      ) : (
        <>
        <Collection gender="men" title="Men" banner={MEN_BANNER} products={s?.men ?? null} loading={loading} />
        <Collection gender="women" title="Women" banner={WOMEN_BANNER} products={s?.women ?? null} loading={loading} reverse />
        <ProductSection eyebrow="Most loved" title="Best sellers" products={s?.best ?? null} loading={loading} link="/shop?collection=best" dark />
        <ProductSection eyebrow="Just dropped" title="New arrivals" products={s?.fresh ?? null} loading={loading} link="/shop?collection=new" />
        </>
      )}
      <Promo />
      <WhyUs />
      <InstagramGallery />
    </>
  );
}
