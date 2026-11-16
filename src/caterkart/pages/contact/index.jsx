import React from "react";
import Seo from "../../../components/Seo";
import Wrapper from "../../components/wrapper";
import { COMPANY, CONTACT, GRIEVANCE_OFFICER, formattedAddress } from "../../../lib/company";
import "../legal/styles.scss";

/**
 * Contact Us.
 *
 * Reuses the legal page's typography deliberately — this is a reference page,
 * read once when somebody needs to reach a human, not a landing page.
 *
 * It exists for two audiences at once. Customers need an obvious way to reach
 * support. Payment providers need it too: Razorpay will not approve an Indian
 * merchant account without a published Contact page carrying a verifiable
 * postal address, a phone number and an email, and the Consumer Protection
 * (E-Commerce) Rules, 2020 require a marketplace entity to publish the same.
 *
 * Everything here comes from src/lib/company.ts, so the address shown on this
 * page, in the Terms, and in the grievance sections cannot drift apart.
 */
export default function ContactPage() {
  const rows = [
    {
      h: "Customer support",
      lines: [
        `Email: ${CONTACT.supportEmail}`,
        `Phone: ${CONTACT.phoneDisplay}`,
        `Hours: ${CONTACT.hours}`,
      ],
      note: "Order changes, delivery questions, and anything that has gone wrong with an order placed through CaterKart.",
    },
    {
      h: "New orders & enquiries",
      lines: [`Email: ${CONTACT.salesEmail}`, `WhatsApp: ${CONTACT.whatsapp}`],
      note: "Bulk orders, event catering, and anything that needs a quote.",
    },
    {
      h: "Grievance Officer",
      lines: [
        GRIEVANCE_OFFICER.name,
        GRIEVANCE_OFFICER.designation,
        `Email: ${GRIEVANCE_OFFICER.email}`,
        `Phone: ${GRIEVANCE_OFFICER.phone}`,
      ],
      note: `Complaints, and any request about your personal data. We acknowledge within ${GRIEVANCE_OFFICER.acknowledgeHours} hours and aim to resolve within ${GRIEVANCE_OFFICER.resolveDays} days. See the Grievance Redressal page for what to raise where.`,
    },
    {
      h: "Security",
      lines: [`Email: ${CONTACT.securityEmail}`],
      note: "Please report a suspected vulnerability privately rather than publicly, so it can be fixed before it is exploited.",
    },
    {
      h: "Registered office",
      lines: [COMPANY.legalName, formattedAddress(), `CIN: ${COMPANY.cin}`, `GSTIN: ${COMPANY.gstin}`],
      note: "CaterKart is a brand operated by this entity. Correspondence and legal notices should be addressed here.",
    },
  ];

  return (
    <Wrapper headertext="CaterKart" headerLeftType="back" footer>
      <Seo
        title="Contact Us"
        description="Reach CaterKart — customer support, new orders, our Grievance Officer, and our registered office address in Bengaluru."
        path="/contact"
      />

      <article className="legal">
        <h1 className="legal__title">Contact Us</h1>
        <p className="legal__intro">
          A real person reads every one of these. Pick whichever is closest to what you
          need — if you are not sure, customer support will route it.
        </p>

        {rows.map((r) => (
          <section className="legal__section" key={r.h}>
            <h2 className="legal__h">{r.h}</h2>
            <ul className="legal__list">
              {r.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
            {r.note && <p className="legal__p">{r.note}</p>}
          </section>
        ))}

        <section className="legal__section">
          <h2 className="legal__h">Where we operate</h2>
          <p className="legal__p">
            CaterKart serves Bengaluru, Karnataka. CaterBox meal boxes and event catering
            are delivered to serviceable pincodes within the city, which you can check at
            checkout. Swiggy group ordering works anywhere Swiggy delivers in Bengaluru.
            We do not currently operate in other cities and do not ship outside India.
          </p>
        </section>
      </article>
    </Wrapper>
  );
}
