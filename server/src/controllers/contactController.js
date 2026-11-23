import { config } from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isContactFormEnabled, sendContactMessage } from '../services/mailer.js';

const alternative = () => (config.contact.email ? ` You can also email us at ${config.contact.email}.` : '');

/**
 * Emails a contact form message to CONTACT_TO. Messages are never stored. The response only says "sent" when the SMTP server
 * accepted the mail; when email is unavailable or fails we say exactly that instead of pretending.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { name, email, topic = 'other', message, website } = req.body;

  // Honeypot filled in: this is a bot. Say nothing useful and send nothing.
  if (website) return res.status(400).json({ success: false, message: 'We could not send your message.' });

  if (!isContactFormEnabled()) {
    return res.status(503).json({ success: false, code: 'email_unavailable', message: `The contact form cannot send email right now, so your message was not sent.${alternative()}` });
  }
  const result = await sendContactMessage({ name, email, topic, message });
  if (result.sent) return res.json({ success: true, data: { sent: true }, message: 'Thank you! Your message was sent.' });
  if (result.reason === 'not_configured') {
    return res.status(503).json({ success: false, code: 'email_unavailable', message: `The contact form cannot send email right now, so your message was not sent.${alternative()}` });
  }
  return res.status(502).json({ success: false, code: 'email_failed', message: `We could not deliver your message just now, so it was not sent. Please try again later.${alternative()}` });
});
