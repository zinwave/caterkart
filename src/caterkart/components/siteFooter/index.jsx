import React from "react";
import { Link } from "react-router-dom";
import { COMPANY, CONTACT } from "../../../lib/company";
import "./styles.scss";

const WHATSAPP_URL = CONTACT.whatsapp;
const PHONE = CONTACT.phoneDial;

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <div className="site-footer__logo">CaterKart</div>
          <p className="site-footer__tagline">Buffet, CaterBox &amp; bulk catering across Bengaluru — food, live counters &amp; more.</p>
        </div>

        <div className="site-footer__cols">
          <nav className="site-footer__group" aria-label="Quick links">
            <span className="site-footer__heading">Company</span>
            <Link to="/about">About us</Link>
            <Link to="/our-kitchen">View our kitchen</Link>
            <Link to="/contact">Contact us</Link>
            {/* Hiring is run by the parent company, so this leaves the app. */}
            <a href={COMPANY.careersUrl} target="_blank" rel="noreferrer">Careers</a>
            <Link to="/track-order">Track order</Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp us</a>
            <a href={`tel:${PHONE}`}>Call us</a>
          </nav>

          <nav className="site-footer__group" aria-label="Legal">
            <span className="site-footer__heading">Legal</span>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms">Terms &amp; Conditions</Link>
            <Link to="/refund-policy">Refunds &amp; Cancellation</Link>
            <Link to="/shipping-policy">Shipping &amp; Delivery</Link>
            <Link to="/cookie-policy">Cookie Policy</Link>
            <Link to="/grievance-redressal">Grievance Redressal</Link>
          </nav>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p className="site-footer__fssai">
          <span className="site-footer__fssai-badge">FSSAI</span>
          Food prepared &amp; supplied by FSSAI-licensed partner vendors.
        </p>
        <p className="site-footer__legal">
          <span>© {year} CaterKart. All rights reserved.</span>
          <span className="site-footer__dot" aria-hidden="true">•</span>
          <span className="site-footer__company">
            A product of{" "}
            <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer">{COMPANY.legalName}</a>
          </span>
        </p>
      </div>
    </footer>
  );
}
