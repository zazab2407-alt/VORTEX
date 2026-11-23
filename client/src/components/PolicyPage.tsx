import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { PolicyDoc } from '../data/policies';

const PLACEHOLDER = /(\[PLACEHOLDER[^\]]*\])/;

/** Renders text, highlighting every [PLACEHOLDER ...] fragment so unfinished content is obvious. */
function Text({ text }: { text: string }) {
  return (
    <>
      {text.split(PLACEHOLDER).map((part, i) =>
        PLACEHOLDER.test(part) ? (
          <mark key={i} className="bg-amber-200 px-1 font-semibold text-neutral-900">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function PolicyPage({ doc }: { doc: PolicyDoc }) {
  useDocumentTitle(doc.title);
  const hasPlaceholders = doc.sections.some((s) => s.paragraphs.some((p) => PLACEHOLDER.test(p))) || PLACEHOLDER.test(doc.intro);
  return (
    <div className="container-x py-8 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">{doc.eyebrow}</p>
        <h1 className="mb-4 text-5xl font-extrabold sm:text-6xl">{doc.title}</h1>
        <p className="mb-8 text-neutral-600"><Text text={doc.intro} /></p>
        {hasPlaceholders && (
          <p role="note" className="mb-10 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Draft content. Highlighted [PLACEHOLDER] text must be replaced with the business's real information before launch.
          </p>
        )}
        <div className="space-y-10">
          {doc.sections.map((s) => (
            <section key={s.heading} aria-labelledby={`h-${s.heading.replace(/\W+/g, '-')}`}>
              <h2 id={`h-${s.heading.replace(/\W+/g, '-')}`} className="mb-3 text-3xl font-extrabold">{s.heading}</h2>
              <div className="space-y-3 leading-relaxed text-neutral-700">
                {s.paragraphs.map((p, i) => <p key={i}><Text text={p} /></p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
