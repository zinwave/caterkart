/**
 * Company, contact and compliance details — one source of truth.
 *
 * These appear across the footer, the legal documents, the Contact page, the
 * grievance sections and the structured data search engines read. Duplicated,
 * they drift: the two footers already disagreed on whether the parent company
 * is "Zinwave Innovation" or "Zinwave Innovations", and only one can be the
 * registered name on an invoice.
 *
 * Several values below are marked TODO. They are facts about a registered
 * company that cannot be inferred from code, and a wrong one is worse than a
 * visible blank — an incorrect GSTIN on an invoice or a made-up FSSAI number is
 * a compliance problem, not a typo. Fill them in here and every page updates.
 */

export const COMPANY = {
  /** Consumer-facing brand. */
  brand: 'CaterKart',

  /** Registered entity that operates the brand, as it must appear on invoices. */
  legalName: 'Zinwave Innovations Pvt Ltd',

  /** The parent company's own site. Note: zinwave.com is an unrelated business. */
  parentUrl: 'https://zinwave.in',
  careersUrl: 'https://zinwave.in/careers',

  // TODO: registered office address, as filed with the MCA. Razorpay requires a
  // real, verifiable address before approving a merchant account, and the
  // Consumer Protection (E-Commerce) Rules require it to be published.
  address: {
    line1: 'TODO: registered office address',
    line2: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: 'TODO',
    country: 'India',
  },

  // TODO: from the certificate of incorporation / GST registration. Leave the
  // placeholder visible rather than inventing one.
  cin: 'TODO: CIN',
  gstin: 'TODO: GSTIN',
} as const;

export const CONTACT = {
  supportEmail: 'support@caterkart.in',
  /** Published separately from support, as the DPDP Act and IT Rules require. */
  grievanceEmail: 'grievance@caterkart.in',
  privacyEmail: 'privacy@caterkart.in',
  securityEmail: 'security@caterkart.in',
  salesEmail: 'hello@caterkart.in',

  phoneDisplay: '+91 72042 42111',
  phoneDial: '+917204242111',
  whatsapp: 'https://wa.me/message/NNNDW6NLLPBZK1',

  /** IST, and stated as such — "9 AM to 9 PM" means nothing without a zone. */
  hours: 'Monday to Sunday, 9:00 AM – 9:00 PM IST',
} as const;

/**
 * The Grievance Officer.
 *
 * Publishing a named officer with direct contact details is required of an
 * intermediary by the IT Rules, 2021 and of a data fiduciary by the DPDP Act,
 * 2023. A generic support address does not satisfy either.
 */
export const GRIEVANCE_OFFICER = {
  name: 'TODO: Grievance Officer name',
  designation: 'Grievance Officer',
  email: CONTACT.grievanceEmail,
  phone: CONTACT.phoneDisplay,
  /** Acknowledge within 48 hours, resolve within 30 days. */
  acknowledgeHours: 48,
  resolveDays: 30,
} as const;

export const SOCIAL = {
  // TODO: replace with the real handles, or remove the icons from the footer.
  // A social button that links nowhere reads as an abandoned product.
  x: '',
  linkedin: '',
  instagram: '',
} as const;

/** Single-line address, for footers and invoice blocks. */
export function formattedAddress(): string {
  const a = COMPANY.address;
  return [a.line1, a.line2, `${a.city} ${a.pincode}`, a.state, a.country]
    .filter(Boolean)
    .join(', ');
}
