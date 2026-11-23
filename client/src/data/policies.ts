/**
 * Editable content for the FAQ, Privacy Policy and Returns & Refunds pages.
 *
 * RULES FOR EDITING:
 * - Text inside [PLACEHOLDER ...] is highlighted on the page. Replace it with the real business information
 *   before launch. Do not remove the brackets until the real text is in place.
 * - Only facts that the software actually does are stated as facts. Legal claims, delivery times, courier names,
 *   retention periods, refund methods and return conditions are placeholders on purpose.
 * - Business contact details (email, phone, address) are NOT written here. They come from the server settings
 *   (STORE_EMAIL, STORE_PHONE, STORE_ADDRESS) and are shown on the Contact page.
 */

export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface PolicyDoc {
  eyebrow: string;
  title: string;
  intro: string;
  sections: PolicySection[];
}

export const FAQ_DOC: PolicyDoc = {
  eyebrow: 'Help',
  title: 'Frequently asked questions',
  intro: 'Answers to the most common questions about shopping with VORTEX.',
  sections: [
    {
      heading: 'How do I pay?',
      paragraphs: [
        'We accept Cash on Delivery only. Pay the courier in cash when your order arrives. Online payment is not available yet.',
      ],
    },
    {
      heading: 'Do I need an account to order?',
      paragraphs: [
        'No. You can check out as a guest. An account lets you see all your orders in one place and saves your details for next time.',
      ],
    },
    {
      heading: 'Can I cancel my order?',
      paragraphs: [
        'Yes, while the order is pending or confirmed. Log in and open the order, or use Track Order with your order number and the email you used at checkout.',
        'Once we start processing an order it can no longer be cancelled online. [PLACEHOLDER: what the customer should do if they want to cancel a processing order]',
      ],
    },
    {
      heading: 'How do I track my order?',
      paragraphs: [
        'Open Track Order and enter your order number and the email address you used at checkout. Logged-in customers can also see their orders under My Account.',
      ],
    },
    {
      heading: 'How does shipping work?',
      paragraphs: [
        'The shipping cost is shown at checkout. Orders at or above the free-shipping threshold shown in the store ship free. The threshold is applied after any discount code.',
        '[PLACEHOLDER: delivery areas, typical delivery times and courier]',
      ],
    },
    {
      heading: 'How do discount codes work?',
      paragraphs: [
        'Enter the code in your cart and press Apply. The code is checked when you apply it. Some codes have a minimum order amount or an expiry date.',
      ],
    },
    {
      heading: 'Where are my cart and wishlist saved?',
      paragraphs: [
        'Your cart, wishlist and applied discount code are stored in your browser on this device. They will not appear on another device.',
      ],
    },
    {
      heading: 'I have another question.',
      paragraphs: [
        'Please use the Contact page to send us a message. [PLACEHOLDER: expected reply time]',
      ],
    },
  ],
};

export const PRIVACY_DOC: PolicyDoc = {
  eyebrow: 'Legal',
  title: 'Privacy policy',
  intro: 'This page explains what personal information VORTEX handles and why. It is a draft until the business completes the placeholders below.',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        '[PLACEHOLDER: legal name of the business, registered address and the contact for privacy questions]',
      ],
    },
    {
      heading: 'What information we collect',
      paragraphs: [
        'Account details: your name, email address and password (stored only as a one-way hash), plus any phone number and address you add to your profile.',
        'Order details: your name, email, phone number, shipping address, the items you ordered and any order note you write.',
        'Contact messages: the name, email, topic and message you send us. These are sent by email and are not stored in our database.',
      ],
    },
    {
      heading: 'Cookies and browser storage',
      paragraphs: [
        'Logging in uses a cookie named vortex_token. It is marked httpOnly, so page scripts cannot read it, and it is needed to keep you logged in.',
        'Your cart, wishlist, applied discount code and the details of your most recent order are kept in your browser so the store works between page visits. You can clear them by clearing your browser storage.',
      ],
    },
    {
      heading: 'Advertising and analytics',
      paragraphs: [
        'The website code does not include advertising or analytics scripts. [PLACEHOLDER: confirm this before launch and list any third-party tools added later]',
      ],
    },
    {
      heading: 'Why we use your information',
      paragraphs: [
        '[PLACEHOLDER: purposes for each type of information and the legal basis for each]',
      ],
    },
    {
      heading: 'Who we share information with',
      paragraphs: [
        '[PLACEHOLDER: couriers, email providers, hosting providers and any other recipients]',
      ],
    },
    {
      heading: 'How long we keep information',
      paragraphs: [
        '[PLACEHOLDER: retention periods for orders, accounts and contact messages]',
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'Passwords are stored as one-way hashes. Login uses an httpOnly cookie. Access to the admin area is limited to store administrators.',
      ],
    },
    {
      heading: 'Your rights and choices',
      paragraphs: [
        '[PLACEHOLDER: how customers can access, correct or delete their information and how to make a request]',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        '[PLACEHOLDER: how changes are announced and the date this policy was last updated]',
      ],
    },
  ],
};

export const RETURNS_DOC: PolicyDoc = {
  eyebrow: 'Help',
  title: 'Returns & refunds',
  intro: 'How returns, cancellations and refunds work at VORTEX. The full terms are being finalised by the business.',
  sections: [
    {
      heading: 'Cancelling before delivery',
      paragraphs: [
        'You can cancel an order while it is pending or confirmed. Once cancelled, the items return to stock and no payment is due, because orders are paid in cash on delivery.',
      ],
    },
    {
      heading: 'Return window',
      paragraphs: [
        '[PLACEHOLDER: number of days a customer has to request a return, or state that returns are not accepted]',
      ],
    },
    {
      heading: 'Which items can be returned',
      paragraphs: [
        '[PLACEHOLDER: eligibility conditions, such as condition of the item, tags and hygiene rules]',
      ],
    },
    {
      heading: 'How to request a return',
      paragraphs: [
        '[PLACEHOLDER: step-by-step process and the contact channel to use]',
      ],
    },
    {
      heading: 'Damaged or incorrect items',
      paragraphs: [
        '[PLACEHOLDER: what to do if an item arrives damaged or is not the one ordered, and any time limit]',
      ],
    },
    {
      heading: 'How refunds are paid',
      paragraphs: [
        '[PLACEHOLDER: refund method (for example cash or bank transfer), refund timing and any deductions]',
      ],
    },
  ],
};
