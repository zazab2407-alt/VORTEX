import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { isPlainEmail } from '../config/settings.js';
import { formatMoney } from '../utils/currency.js';

let transport = null;
let testTransport = null;
/** Tests inject a fake transport; production uses the SMTP settings from .env. */
export const setTransportForTests = (t) => { testTransport = t; };
export const isEmailConfigured = () => Boolean(testTransport || config.smtp.enabled);
/** The contact form needs both a way to send mail and an inbox to send it to (CONTACT_TO). */
export const isContactFormEnabled = () => isEmailConfigured() && Boolean(config.contact.to);

function getTransport() {
  if (testTransport) return testTransport;
  if (!config.smtp.enabled) return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
  });
  return transport;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => formatMoney(n);
/** One line, no header-injection characters. */
const oneLine = (s, max = 200) => String(s ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** Log the error CODE only: provider messages can echo account names or server details. Never log credentials or message bodies. */
const why = (err) => err?.code || err?.responseCode || (err?.message === 'timeout' ? 'timeout' : 'error');

export function buildConfirmationEmail(order) {
  const lines = order.items.map((i) => `${i.quantity} x ${i.name} (${i.size} / ${i.color})  ${money(i.lineTotal)}`);
  const totals = [`Subtotal: ${money(order.subtotal)}`, order.discount > 0 ? `Discount${order.couponCode ? ` (${order.couponCode})` : ''}: -${money(order.discount)}` : null, `Shipping: ${order.shippingCost === 0 ? 'Free' : money(order.shippingCost)}`, `Total: ${money(order.total)}`].filter(Boolean);
  const text = [
    `Thank you for your order, ${order.customer.fullName}!`, '', `Order number: ${order.orderNumber}`, '', ...lines, '', ...totals, '',
    'Payment: Cash on Delivery. Please pay the courier when your order arrives.',
    `Shipping to: ${order.shippingAddress.address}, ${order.shippingAddress.city}`, '',
    'You can track your order any time with your order number and this email address.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2>Thank you for your order, ${esc(order.customer.fullName)}!</h2><p>Order number: <strong>${esc(order.orderNumber)}</strong></p><ul>${order.items.map((i) => `<li>${i.quantity} x ${esc(i.name)} (${esc(i.size)} / ${esc(i.color)}) - ${money(i.lineTotal)}</li>`).join('')}</ul><p>${totals.map(esc).join('<br>')}</p><p>Payment: Cash on Delivery. Please pay the courier when your order arrives.</p><p>Shipping to: ${esc(order.shippingAddress.address)}, ${esc(order.shippingAddress.city)}</p></div>`;
  return { subject: `Your ${config.store.name} order ${order.orderNumber}`, text, html };
}

/** Sends with a time limit. Resolves { sent: true } ONLY after the mail server accepted the message; never throws. */
async function deliver(mail, { timeoutMs, label }) {
  const t = getTransport();
  if (!t) return { sent: false, reason: 'not_configured' };
  let timer;
  try {
    await Promise.race([
      t.sendMail({ from: config.smtp.from, ...mail }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); }),
    ]);
    return { sent: true };
  } catch (err) {
    console.error(`[mail] ${label} not sent (${why(err)})`);
    return { sent: false, reason: 'failed' };
  } finally { clearTimeout(timer); }
}

/**
 * Resolves { sent: true } ONLY after the mail server accepted the message. Never throws: an order must not fail
 * because email did. Callers should say "email sent" to the customer only when `sent` is true.
 */
export async function sendOrderConfirmation(order, { timeoutMs = 5000 } = {}) {
  if (!getTransport()) return { sent: false, reason: 'not_configured' };
  // Refuse addresses with quotes, commas, brackets etc.: they are valid in theory but are how mail gets redirected to another domain
  if (!isPlainEmail(order.customer.email)) return { sent: false, reason: 'failed' };
  return deliver({ to: order.customer.email, ...buildConfirmationEmail(order) }, { timeoutMs, label: 'order confirmation' });
}

export function buildContactEmail({ name, email, topic, message }) {
  const n = oneLine(name, 80); const t = oneLine(topic, 40);
  const text = [`New message from the ${config.store.name} contact form`, '', `Name: ${n}`, `Email: ${email}`, `Topic: ${t}`, '', message].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2>New contact form message</h2><p><strong>Name:</strong> ${esc(n)}<br><strong>Email:</strong> ${esc(email)}<br><strong>Topic:</strong> ${esc(t)}</p><p style="white-space:pre-wrap">${esc(message)}</p></div>`;
  return { subject: oneLine(`[${config.store.name} contact] ${t}: ${n}`, 120), text, html };
}

/** Same honesty rules as order emails: { sent: true } only when the server accepted it. The message is never stored or logged. */
export async function sendContactMessage(input, { timeoutMs = 8000 } = {}) {
  if (!isContactFormEnabled()) return { sent: false, reason: 'not_configured' };
  if (!isPlainEmail(input.email)) return { sent: false, reason: 'invalid_email' };
  return deliver({ to: config.contact.to, replyTo: input.email, ...buildContactEmail(input) }, { timeoutMs, label: 'contact message' });
}

/** Startup check so a typo in SMTP settings is noticed early. Never throws and never prints credentials. */
export async function verifySmtp({ timeoutMs = 8000 } = {}) {
  const t = getTransport();
  if (!t?.verify) return { ok: false, reason: 'not_configured' };
  let timer;
  try {
    await Promise.race([t.verify(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); })]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(why(err)) };
  } finally { clearTimeout(timer); }
}
