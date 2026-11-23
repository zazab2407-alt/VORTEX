import { useState, type FormEvent } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useShopSettings } from '../hooks/useShopConfig';
import { useToast } from '../context/ToastContext';
import { contactService } from '../services/shop';
import { ApiClientError } from '../services/http';
import Field from '../components/Field';

const TOPICS = [
  { value: 'order', label: 'My order' },
  { value: 'product', label: 'A product' },
  { value: 'returns', label: 'Returns or refunds' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Something else' },
];
const EMAIL = /^\S+@\S+\.\S+$/;

type Errors = Partial<Record<'name' | 'email' | 'message', string>>;

export default function Contact() {
  useDocumentTitle('Contact');
  const { config, loaded } = useShopSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', topic: 'order', message: '', website: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your name';
    if (!EMAIL.test(form.email.trim())) next.email = 'Please enter a valid email address';
    if (form.message.trim().length < 10) next.message = 'Please write at least 10 characters';
    setErrors(next); setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await contactService.send({ name: form.name.trim(), email: form.email.trim(), topic: form.topic, message: form.message.trim(), website: form.website || undefined });
      setSent(true);
      toast('Your message was sent');
    } catch (err) {
      // The server only says "sent" when the mail server accepted the message; its wording is shown as-is.
      setFormError(err instanceof ApiClientError ? err.message : 'We could not send your message. Please try again later.');
    } finally { setBusy(false); }
  };

  const formAvailable = loaded && config.contact.formEnabled;
  const contactLines = [
    config.contact.email && { label: 'Email', value: config.contact.email, href: `mailto:${config.contact.email}` },
    config.contact.phone && { label: 'Phone', value: config.contact.phone, href: `tel:${config.contact.phone.replace(/\s+/g, '')}` },
    config.contact.address && { label: 'Address', value: config.contact.address, href: undefined },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <div className="container-x py-8 lg:py-12">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">Get in touch</p>
          <h1 className="mb-4 text-5xl font-extrabold sm:text-6xl">Contact us</h1>
          <p className="mb-8 text-neutral-600">Questions about an order, a product or a return? Send us a message. [PLACEHOLDER: expected reply time and opening hours]</p>

          {contactLines.length > 0 ? (
            <dl className="space-y-4">
              {contactLines.map((c) => (
                <div key={c.label}>
                  <dt className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{c.label}</dt>
                  <dd className="text-lg">{c.href ? <a href={c.href} className="underline underline-offset-4 hover:text-brand">{c.value}</a> : c.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
              Contact details are not published yet. [PLACEHOLDER: business email, phone and address, set in the server settings (STORE_EMAIL, STORE_PHONE, STORE_ADDRESS)]
            </p>
          )}
        </div>

        <div>
          {sent ? (
            <div role="status" className="border border-green-200 bg-green-50 p-6">
              <h2 className="mb-2 text-3xl font-extrabold">Thank you</h2>
              <p className="text-green-900">Your message was sent. [PLACEHOLDER: what happens next]</p>
              <button className="btn btn-dark mt-6" onClick={() => { setSent(false); setForm({ name: '', email: '', topic: 'order', message: '', website: '' }); }}>Send another message</button>
            </div>
          ) : !loaded ? (
            <p className="text-neutral-500" role="status">Loading...</p>
          ) : !formAvailable ? (
            <div role="status" className="border border-neutral-200 bg-neutral-100 p-6">
              <h2 className="mb-2 text-3xl font-extrabold">Contact form unavailable</h2>
              <p className="text-neutral-700">
                The contact form cannot send messages right now, so your message would not be delivered.
                {config.contact.email ? <> Please email us at <a className="font-semibold underline" href={`mailto:${config.contact.email}`}>{config.contact.email}</a> instead.</> : ' Please try again later.'}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5" aria-label="Contact form">
              {formError && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
              <Field label="Your name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} />
              <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} hint="Used to reply to your message." />
              <div>
                <label htmlFor="contact-topic" className="mb-1.5 block text-sm font-semibold">Topic</label>
                <select id="contact-topic" className="input" value={form.topic} onChange={set('topic')}>
                  {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <Field label="Message" multiline rows={6} value={form.message} onChange={set('message')} error={errors.message} maxLength={2000} hint="At least 10 characters." />
              {/* Honeypot: hidden from people, filled in only by bots. */}
              <div className="hidden" aria-hidden="true">
                <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending...' : 'Send message'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
