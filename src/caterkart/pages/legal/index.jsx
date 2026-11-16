import React from "react";
import Seo from "../../../components/Seo";
import Wrapper from "../../components/wrapper";
import "./styles.scss";

import { COMPANY, CONTACT, GRIEVANCE_OFFICER, formattedAddress } from "../../../lib/company";

const SUPPORT_EMAIL = CONTACT.supportEmail;
const SUPPORT_PHONE = CONTACT.phoneDisplay;
const UPDATED = "November 2026";

const DOCS = {
  privacy: {
    title: "Privacy Policy",
    numbered: true,
    intro:
      "This Privacy Policy explains how CaterKart (\"we\", \"us\") collects, uses, shares, and protects your information when you use our website and application (the \"Platform\"). It covers both of our services, which handle your data differently: (a) CaterBox and event catering, where we connect you with independent, FSSAI-licensed partner kitchens; and (b) Swiggy group ordering, where — with your explicit authorisation — we place orders on your own Swiggy account on your behalf. Section 2 explains the Swiggy integration in full, including exactly what we can and cannot do with that authorisation. We are the data fiduciary for the personal data described here under the Digital Personal Data Protection Act, 2023.",
    sections: [
      {
        h: "Information we collect",
        points: [
          "Contact & delivery details you provide when ordering: your name, mobile number, delivery address, locality/area, and pincode.",
          "Order information: the items, combos, meal type, headcount/guests, event type, date/time, dietary preferences (e.g. veg/non-veg), and any notes you add.",
          "Verification data: a one-time password (OTP) is sent to your mobile number to verify it when placing or tracking an order.",
          "Technical data: basic device and usage information (such as browser type and pages visited) needed to operate and secure the Platform. We store your in-progress cart and preferences locally on your device (browser local storage) to improve your experience.",
          "Swiggy group ordering (only if you use it): an encrypted authorisation credential for your Swiggy account, a masked version of the phone number on that account so you can see which account is connected, the delivery address you select from your own Swiggy address book, and the order identifiers needed to track and reconcile your order. See section 2 for exactly what this authorisation does and does not permit.",
          "Guest event data: if you host an event, the names and optional contact details of guests you invite; if you join one, the name and dietary preference you enter and the dishes you choose.",
          "We do NOT collect or store your payment card details on the Platform; payments, where applicable, are handled by third-party payment processors. We do not collect your Swiggy password. We do not knowingly collect sensitive personal data beyond what is needed to fulfil an order.",
        ],
      },
      {
        h: "How we use your information",
        points: [
          "To place, process, assign to a Vendor, and fulfil your order, and to arrange delivery.",
          "To verify your identity/mobile number via OTP and to let you track your orders.",
          "To provide customer support, send order-related updates, and respond to your requests.",
          "To operate, secure, troubleshoot, and improve the Platform and our service quality.",
          "To comply with legal, tax, and accounting obligations.",
        ],
      },
      {
        h: "How we share your information",
        points: [
          "With the assigned Vendor: to prepare and supply your order, we share your name, contact number, delivery address, and order details. The Vendor processes this information to fulfil your order.",
          "With delivery partners: where a third party delivers your order, we share the details needed for delivery (name, address, contact number).",
          "With payment processors: to complete a transaction, the necessary details are shared with the payment gateway.",
          "With service providers: trusted vendors who provide hosting, SMS/OTP, and similar services on our behalf, under confidentiality obligations.",
          "For legal reasons: where required by law, regulation, or valid legal process, or to protect rights, safety, and prevent fraud.",
          "With Swiggy: only if you use Swiggy group ordering, and only the order details needed to place and track it on your behalf — see section 2.",
          "We do NOT sell your personal information, and we do not share it for third-party advertising.",
        ],
      },
      {
        h: "Swiggy group ordering — what you authorise, and what we can do with it",
        p: "This section applies only if you use CaterKart to place a group order through Swiggy. It is the most consequential permission the Platform asks for, so it is set out in full rather than summarised.",
        points: [
          "WHAT YOU GRANT. When you choose \"Continue with Swiggy\", you are sent to Swiggy to sign in. Swiggy — not CaterKart — verifies your identity, and then issues CaterKart a limited access credential for your account. We never see, receive, or store your Swiggy password or the one-time code Swiggy sends you.",
          "WHAT WE CAN DO WITH IT. The credential lets us act on your Swiggy account to do the things the Platform needs: read your saved delivery addresses, search restaurants and menus, build a cart, apply coupons, PLACE ORDERS, and track them. Orders we place are real orders on your account, charged to your Swiggy payment method. We only ever place an order when you explicitly confirm it on the Platform.",
          "WHAT WE CANNOT DO. The credential does not give us your Swiggy password, your saved cards or UPI handles, or the ability to change your Swiggy account settings or log in as you anywhere else.",
          "HOW LONG IT LASTS. Swiggy's credential is valid for approximately five days and is renewed automatically while you keep using the Platform. You can revoke it at any time from your CaterKart profile (\"Disconnect Swiggy\"), which deletes it immediately from our systems. Revoking does not delete your CaterKart account, your past events, or your order history.",
          "HOW IT IS PROTECTED. The credential never reaches your browser or any guest's. It is held only on our servers, encrypted at rest with AES-256-GCM, and decrypted solely at the moment an authorised call to Swiggy is made on your behalf.",
          "WHAT SWIGGY RECEIVES. To place and track an order we send Swiggy the details it needs: the selected address, cart contents, and any coupon. Swiggy processes this under its own privacy policy, which governs your relationship with them and which we encourage you to read.",
          "WHAT WE KEEP. We store an encrypted copy of the Swiggy credential, a masked form of the phone number on your Swiggy account (for example ****0778) so you can see which account is connected, and the Swiggy order identifiers needed to track and reconcile your order. We do not copy your Swiggy address book, payment methods, or order history into our systems.",
        ],
      },
      {
        h: "Guests you invite (and being a guest)",
        points: [
          "IF YOU ARE A HOST. When you invite someone, you may give us their name and, optionally, their phone number or email so we can create their invitation. We use these only to generate and send the invite and to show you who has responded. We do not market to your guests, add them to any list, or contact them for any purpose other than the event you invited them to.",
          "IF YOU ARE A GUEST. Opening an invite link does not create an account and does not require a Swiggy login or any payment method. We collect the name you enter, any dietary preference you select, and the dishes you choose, so the host can assemble the order and work out the split. Your device also keeps a local copy of your own choices so you can return to the link without starting over; it is cleared automatically about thirty days later.",
          "WHAT A GUEST CAN SEE. An invite link lets a guest view that one event, see the other guests' names and dietary preferences, and browse menus for the host's chosen delivery address. A guest cannot see the host's Swiggy account, place an order, or pay for anything.",
          "TREAT INVITE LINKS AS PRIVATE. The link itself is the credential — anyone who has it can see the event. Share it only with the people you are inviting. Links stop working after seven days and are then deleted.",
        ],
      },
      {
        h: "Bill splitting and UPI links",
        p: "If you use the split-the-bill feature, we calculate what each guest owes from the order's own line items and generate a standard UPI payment link addressed to whoever paid. CaterKart does not process, hold, route, or take a cut of those payments — the link simply opens the guest's own UPI app, pre-filled. We record only whether a share has been marked as settled, which the host does manually.",
      },
      {
        h: "Cookies & local storage",
        p: "We use your browser's local storage to remember your in-progress order and preferences, and minimal cookies/storage strictly necessary to run the Platform. We do not use third-party advertising or cross-site tracking cookies. You can clear this data anytime through your browser settings.",
      },
      {
        h: "Data retention",
        p: "We keep personal data only as long as the purpose it was collected for lasts, and an automated process deletes it on the schedule below. Financial records are the exception: tax and accounting law requires us to retain invoices and payment records for longer, and we keep those for the statutory period.",
        points: [
          "Incomplete sign-in attempts: deleted after 10 minutes.",
          "Invite links and the guest data attached to them: deleted 7 days after the link expires.",
          "Order tracking events: deleted after 90 days.",
          "Completed or cancelled events, including guest lists and dish selections: deleted after 12 months.",
          "Your Swiggy authorisation: deleted immediately when you disconnect it, or when it lapses and is not renewed.",
          "Invoices, payment records and tax documents: retained for the period required by Indian tax and accounting law.",
        ],
      },
      {
        h: "Data security",
        p: "We use technical and organisational measures appropriate to the sensitivity of the data: your Swiggy authorisation is encrypted at rest with AES-256-GCM and never leaves our servers; sessions are held in signed, HTTP-only cookies that scripts cannot read; all traffic is served over HTTPS; access to each event and order is checked against the signed-in account on every request; and our logs are automatically scrubbed of credentials, phone numbers, email addresses and delivery addresses. We never see or store your card details — payments are handled entirely by the relevant payment processor. No system is completely secure, and we cannot guarantee absolute security.",
      },
      {
        h: "Your rights & choices",
        points: [
          `You may request access to, correction of, or deletion of your personal data by writing to ${SUPPORT_EMAIL}.`,
          "You may withdraw consent or object to certain processing, subject to legal and contractual limits (note that we may be unable to fulfil orders without the necessary details).",
          "You can clear locally stored cart/preference data via your browser at any time.",
          "You can revoke CaterKart's access to your Swiggy account at any time from your profile (\"Disconnect Swiggy\"); the credential is deleted immediately and we can no longer act on that account.",
          "We will respond to verified requests within the timelines required by applicable law, including the Digital Personal Data Protection Act, 2023.",
        ],
      },
      {
        h: "Third-party links & vendors",
        p: "The Platform may link to or rely on third parties (such as Vendors, payment, and delivery partners). Their handling of your information is governed by their own privacy practices, and we are not responsible for those practices. We encourage you to review them where relevant.",
      },
      {
        h: "Children",
        p: "The Platform is intended for users aged 18 and above. We do not knowingly collect personal data from children. If you believe a child has provided us information, please contact us so we can delete it.",
      },
      {
        h: "Grievance Officer",
        p: `In accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, you may contact our Grievance Officer about any concern relating to your personal data, including a request to access, correct, or erase it, or to withdraw consent. Write to ${SUPPORT_EMAIL} with "Data request" in the subject line, or call ${SUPPORT_PHONE}. We acknowledge within 48 hours and aim to resolve within 30 days. If you are not satisfied with our response, you may escalate to the Data Protection Board of India.`,
      },
      {
        h: "Transfers outside India",
        p: "Our systems are hosted in India (AWS Asia Pacific, Mumbai). Some of the service providers we rely on — for SMS delivery, payment processing, and error monitoring — may process limited data outside India under contractual safeguards. We do not otherwise transfer your personal data abroad.",
      },
      {
        h: "Changes to this policy",
        p: "We may update this Privacy Policy from time to time. Material changes will be reflected by updating the \"Last updated\" date above. Your continued use of the Platform after changes constitutes acceptance of the updated policy.",
      },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    numbered: true,
    intro:
      "These Terms & Conditions (\"Terms\") govern your access to and use of the CaterKart website, application, and services (the \"Platform\"). By accessing the Platform or placing an order, you (\"Customer\", \"you\") agree to these Terms. CaterKart offers three distinct services, and which one you use determines who you are contracting with and who is responsible for your food. Section 1 sets this out; please read it before the rest. If you do not agree to these Terms, please do not use the Platform.",
    sections: [
      {
        h: "The three services, and who is responsible in each",
        p: "CaterKart is not a single service. Read the one that applies to your order — the answer to \"who prepared my food and who do I claim against\" is different in each.",
        points: [
          "(A) VENDOR CATERING — the aggregator model. For event and bulk catering fulfilled by a partner, CaterKart is a technology platform that connects you with an independent third-party vendor or caterer (\"Vendor\"). The contract for the sale and supply of food is between you and that Vendor. CaterKart is not a party to it and acts only as a facilitator and, where applicable, a limited payment-collection agent on the Vendor's behalf. The Vendor is the sole preparer and seller.",
          "(B) CATERBOX MEAL BOXES — aggregator model, with CaterKart collecting payment. CaterBox meal boxes are prepared and supplied by independent, FSSAI-licensed partner kitchens (\"Vendors\") working to a menu CaterKart specifies. CaterKart does not cook, prepare, process, package, or sell the food. We design the box, assign a suitable Vendor, collect payment as a limited collection agent on that Vendor's behalf, and coordinate delivery. The Vendor is the preparer and the seller, and the food-safety responsibilities in the section below apply in full.",
          "(C) SWIGGY GROUP ORDERING — placed on your own account. Here CaterKart neither prepares nor sells the food and is not the seller or the merchant of record. You authorise us to place an order on YOUR Swiggy account; the restaurant is the seller, Swiggy is the platform and payment processor, and the transaction is governed by Swiggy's own terms. CaterKart's role is limited to assembling the order from your guests' choices, timing the placement, and showing you the result. Section 4 covers this service in full.",
        ],
      },
      {
        h: "Swiggy group ordering — specific terms",
        points: [
          "YOUR AUTHORISATION. Using this service requires you to authorise CaterKart, through Swiggy's own sign-in, to act on your Swiggy account. You may revoke that authorisation at any time from your CaterKart profile. You must be the account holder; do not authorise an account that is not yours.",
          "ORDERS ARE REAL AND ARE YOURS. An order placed through this service is a genuine order on your Swiggy account, charged to your Swiggy payment method, and is your order as against the restaurant and Swiggy. We place one only after you explicitly confirm it. You are responsible for reviewing the cart and total before confirming.",
          "ORDERS CANNOT BE UNDONE BY US. Once placed, an order is subject to Swiggy's and the restaurant's cancellation rules. CaterKart has no ability to cancel, modify, or refund it. Cancellations, refunds, missing items, and food-quality complaints for these orders must be raised with Swiggy or the restaurant.",
          "THINGS OUTSIDE OUR CONTROL. Restaurant availability, menu accuracy, pricing, coupon eligibility, delivery times, order caps, and serviceability are determined by Swiggy and the restaurant, not by CaterKart. We show you what Swiggy reports and cannot guarantee it.",
          "TIMING IS AN ESTIMATE. Where multiple orders are scheduled to converge, the timing is calculated from the delivery estimates Swiggy provides. Those estimates change, and we do not warrant that orders will arrive together.",
          "IF AN ORDER FAILS MID-PLACEMENT. Placement is not reversible or safely repeatable. If a placement call fails after being sent, we do not retry it automatically; we check your Swiggy order list and tell you what we find. Always confirm in the Swiggy app before re-ordering.",
          "GUESTS. Anyone you invite can choose dishes but cannot place or pay for anything. You, as host, remain solely responsible for the order and its cost. Splitting the bill is a calculation and a payment link we provide for convenience; CaterKart does not process, hold, or guarantee any repayment between you and your guests.",
        ],
      },
      {
        h: "Intermediary status",
        p: "CaterKart functions as an \"intermediary\" within the meaning of the Information Technology Act, 2000 and the rules made thereunder, and as a \"marketplace e-commerce entity\" under the Consumer Protection (E-Commerce) Rules, 2020. CaterKart merely provides the technology that enables a transaction between a Customer and a Vendor and is not responsible for, and does not warrant or guarantee, the acts, omissions, conduct, representations, or offerings of any Vendor.",
      },
      {
        h: "Vendor responsibility for food quality, safety & consequences (services A and B)",
        p: "This section applies to all food ordered through CaterKart that is prepared by a partner — both event catering and CaterBox meal boxes. For Swiggy group orders (service C) the restaurant is the seller and Swiggy's own terms govern.",
        points: [
          "The assigned Vendor is solely, fully, and exclusively responsible for the sourcing, preparation, cooking, hygiene, quality, taste, freshness, temperature, quantity, packaging, labelling, and safety of the food supplied against your order.",
          "Each Vendor is independently required to hold and maintain a valid FSSAI licence/registration and to comply with the Food Safety and Standards Act, 2006, the rules and regulations thereunder, and all applicable food-safety, health, hygiene, labour, and licensing laws.",
          "The Vendor is solely responsible for the accuracy of all food-related information, including ingredients, allergens, dietary classification (veg/non-veg/contains egg, etc.), portion sizes, and preparation methods.",
          "Any liability, claim, demand, loss, injury, illness, food poisoning, allergic reaction, contamination, spoilage, foreign object, or any other harm or consequence arising out of or relating to the food — including its sourcing, preparation, quality, condition, packaging, delivery temperature, or consumption — rests solely with the Vendor and not with CaterKart.",
          "You acknowledge and agree that CaterKart bears no responsibility or liability whatsoever for the food itself, and that any complaint regarding food quality or safety is a matter between you and the Vendor, which CaterKart will reasonably facilitate but is not obligated to resolve as a principal.",
        ],
      },
      {
        h: "Limitation of CaterKart's liability",
        points: [
          "The Platform and CaterKart's services are provided on an \"as is\" and \"as available\" basis. CaterKart makes no warranty, express or implied, regarding food supplied by a Vendor or by a restaurant on Swiggy, including any warranty of merchantability, fitness for a particular purpose, quality, or safety.",
          "To the maximum extent permitted by applicable law, CaterKart shall not be liable for any direct, indirect, incidental, special, punitive, or consequential damages arising out of or in connection with the food, its quality, safety, preparation, delivery, or consumption, or the acts or omissions of any Vendor.",
          "CaterKart's total aggregate liability for any matter genuinely and directly attributable to CaterKart's own platform services (for example, a scheduling or payment-processing error) shall not exceed the platform/convenience fee component actually retained by CaterKart for the relevant order, or INR 1,000, whichever is lower.",
          "Nothing in these Terms excludes or limits any liability that cannot be excluded or limited under applicable law, including the Consumer Protection Act, 2019.",
        ],
      },
      {
        h: "Vendor indemnity",
        p: "Each Vendor, by accepting orders through the Platform, agrees to indemnify, defend, and hold harmless CaterKart, its directors, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to the food supplied by such Vendor, any breach of food-safety or licensing laws, or any act or omission of the Vendor.",
      },
      {
        h: "Orders & vendor assignment",
        points: [
          "All orders are subject to availability, Vendor acceptance, and confirmation. Menu items, prices, portions, and availability may change without notice.",
          "Bulk, corporate, and event orders may require advance notice, a minimum order value, and an advance payment as communicated at the time of booking.",
          "CaterKart may, at its discretion and to fulfil your requirement, assign, re-assign, or substitute a Vendor of comparable standard, including where the originally selected Vendor is unavailable.",
        ],
      },
      {
        h: "Pricing, taxes & payment",
        p: "All prices are in Indian Rupees (INR) and, unless stated otherwise, are shown inclusive or exclusive of applicable taxes at checkout. A platform/convenience and/or delivery fee may apply and will be displayed before you confirm. Where CaterKart collects payment, it does so as a limited payment-collection agent on behalf of the Vendor; the underlying sale consideration belongs to the Vendor.",
      },
      {
        h: "Delivery",
        p: "Delivery may be carried out by the Vendor or by a third-party delivery partner. We aim to deliver within the agreed time window; however, timelines are estimates and may be affected by traffic, weather, demand, or other factors beyond reasonable control. Risk in the food passes on delivery; please inspect items on receipt.",
      },
      {
        h: "Cancellations & refunds",
        p: "Cancellations and refunds are governed by our Refund & Cancellation Policy. Where a refund is due on account of a food-quality issue, CaterKart will facilitate the refund process, but the underlying responsibility and cost for such issue rests with the Vendor.",
      },
      {
        h: "Allergens, dietary requirements & safe consumption",
        p: "Food may contain or come into contact with allergens. You are responsible for informing us of allergies or dietary restrictions and for relying on the Vendor's disclosures. Perishable food should be consumed promptly after delivery and stored appropriately; CaterKart and the Vendor are not responsible for deterioration due to improper handling after delivery.",
      },
      {
        h: "Customer obligations",
        points: [
          "Provide accurate and complete order, contact, and delivery information.",
          "Use the Platform only for lawful purposes and not to place fraudulent, abusive, or speculative orders.",
          "Treat Vendors and delivery personnel with respect and provide safe access for delivery.",
        ],
      },
      {
        h: "Intellectual property",
        p: "The Platform, including its design, software, trademarks, logos, and content (excluding Vendor-supplied content), is owned by or licensed to CaterKart and is protected by applicable laws. You may not copy, modify, or exploit it without prior written permission.",
      },
      {
        h: "Disclaimers",
        p: "CaterKart does not warrant that the Platform will be uninterrupted, error-free, or secure, or that any Vendor, food item, or outcome will meet your expectations. Your use of the Platform and any reliance on Vendor offerings is at your own risk, subject to the protections available to you under applicable consumer law.",
      },
      {
        h: "Grievance redressal",
        p: `In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, complaints may be addressed to our Grievance Officer at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}. We acknowledge a complaint within 48 hours and endeavour to resolve it within one month of receipt. For food-quality complaints on a vendor-fulfilled order we coordinate with the Vendor, who remains responsible for resolution; for CaterBox orders the complaint is ours to resolve; for Swiggy group orders, raise it with Swiggy or the restaurant, as the order sits on your Swiggy account.`,
      },
      {
        h: "Governing law & jurisdiction",
        p: "These Terms are governed by the laws of India. Subject to applicable consumer-protection law, the courts at Bengaluru, Karnataka shall have jurisdiction over disputes arising out of or relating to these Terms or the Platform.",
      },
      {
        h: "Changes to these Terms",
        p: "CaterKart may update these Terms from time to time. Material changes will be reflected by updating the \"Last updated\" date above. Your continued use of the Platform after such changes constitutes acceptance of the revised Terms.",
      },
    ],
  },
  refund: {
    title: "Refund & Cancellation Policy",
    intro:
      "We want you to be happy with every order. This policy covers CaterBox and event catering orders paid to CaterKart. It does NOT cover Swiggy group orders — those are placed on your own Swiggy account and are governed by Swiggy's cancellation and refund rules (see the first section below).",
    sections: [
      { h: "Swiggy group orders are not covered by this policy", p: "An order placed through Swiggy group ordering is your order on your Swiggy account, paid through Swiggy. CaterKart is not the seller and holds none of the money, so we cannot cancel, modify, or refund it. Raise cancellations, missing items, and quality complaints with Swiggy or the restaurant through the Swiggy app, where the order and its payment live." },
      { h: "Cancellations", p: "Standard orders can be cancelled before they are sent to the kitchen for preparation. Bulk and event orders can be cancelled up to the notice period agreed at the time of booking." },
      { h: "Refunds", p: "Approved refunds are processed to the original payment method within 5–7 business days. Advance amounts for cancelled event orders are refundable as per the agreed notice period." },
      { h: "Quality issues", p: `If something is wrong with your order, contact us within 2 hours of delivery with photos at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}, and we'll make it right with a replacement or refund.` },
      { h: "Non-refundable", p: "Custom-prepared bulk orders already dispatched and add-ons consumed are not refundable except in case of a quality issue." },
    ],
  },
  shipping: {
    title: "Shipping & Delivery Policy",
    numbered: true,
    intro:
      "This policy explains how, where, and when orders placed through CaterKart are delivered. CaterKart delivers prepared food, not shippable goods, so there is no courier, tracking number, or return shipment — the sections below describe what actually happens instead.",
    sections: [
      {
        h: "Where we deliver",
        points: [
          "CaterBox meal boxes and event catering: Bengaluru, Karnataka only. Serviceability is checked by pincode at checkout; if your pincode is not covered, the order cannot be placed.",
          "Swiggy group orders: anywhere Swiggy delivers, determined entirely by Swiggy and the restaurant, not by CaterKart.",
          "We do not ship outside India and do not offer international delivery.",
        ],
      },
      {
        h: "Delivery timelines",
        points: [
          "CaterBox meal boxes and event catering are cooked to order and require advance notice — typically at least 7 days for large orders, confirmed in writing at the time of booking. The delivery date and slot agreed at booking is the committed window.",
          "Swiggy group orders are same-day and typically arrive within 30 to 75 minutes, per the estimate Swiggy provides at the time of ordering.",
          "Where CaterKart schedules several Swiggy orders to arrive together, the timing is calculated from Swiggy's own delivery estimates. Those estimates change, and we cannot guarantee simultaneous arrival.",
        ],
      },
      {
        h: "Delivery charges",
        p: "Any delivery or packaging charge is shown at checkout before you confirm and is included in the total. For Swiggy group orders, delivery fees are set and collected by Swiggy on your own account; CaterKart adds nothing to them.",
      },
      {
        h: "Who delivers",
        points: [
          "CaterBox and event orders are delivered by the assigned partner kitchen or by a third-party delivery partner engaged for the order.",
          "Swiggy group orders are delivered by Swiggy's own delivery network.",
        ],
      },
      {
        h: "On delivery",
        points: [
          "Someone must be available at the delivery address during the agreed window to receive the order, and must provide safe access for the delivery person.",
          "Please inspect the order on receipt. Risk in the food passes on delivery.",
          "If nobody is available and the order cannot be handed over, we will attempt to contact you on the number provided. Prepared food cannot be held or redelivered later, and an order that fails for this reason is not refundable.",
        ],
      },
      {
        h: "Delays",
        p: "Timelines are commitments we work hard to meet, but traffic, weather, demand surges, and events outside reasonable control can affect them. We will contact you proactively about a material delay. Where a delay is attributable to CaterKart or the assigned Vendor and makes the order unusable for its purpose, the Refund & Cancellation Policy applies.",
      },
      {
        h: "Food safety after delivery",
        p: "Prepared food should be consumed promptly. Once delivered, correct storage and handling are the customer's responsibility, and neither CaterKart nor the Vendor is responsible for deterioration caused by improper handling after delivery.",
      },
      {
        h: "Questions",
        p: `For anything about a delivery in progress, contact us at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} (${CONTACT.hours}).`,
      },
    ],
  },

  cookies: {
    title: "Cookie & Local Storage Policy",
    numbered: true,
    intro:
      "This policy explains what CaterKart stores in your browser and why. The short version: we store only what the Platform needs to work. We run no advertising cookies, no cross-site tracking, and no third-party analytics that profile you.",
    sections: [
      {
        h: "What we store",
        points: [
          "SESSION COOKIE (ck_session) — identifies you after you sign in with Swiggy. Set by our server as HttpOnly and Secure, so no script on the page can read it. Strictly necessary; the Platform cannot keep you signed in without it. Expires after 30 days.",
          "SIGN-IN TOKEN (ck_token) — issued after you verify your phone by OTP for a CaterBox order, and used to authenticate your order and payment requests. Stored in local storage and valid for 7 days.",
          "YOUR IN-PROGRESS ORDER — the box you are configuring, the guests you have added, and the dishes selected, so a refresh or a dropped connection does not lose your work. Stored locally on your device only.",
          "SELECTED DELIVERY ADDRESS — the identifier of the Swiggy address you chose, so you do not re-pick it on every visit.",
          "GUEST SELECTIONS — if you open an invite link, your own name, dietary preference and dish choices, so you can return to the link without starting over. Cleared automatically about 30 days later.",
        ],
      },
      {
        h: "What we do NOT use",
        points: [
          "No advertising or retargeting cookies.",
          "No cross-site tracking, and no sale or sharing of browsing data with advertisers.",
          "No third-party analytics that build a profile of you across sites.",
        ],
      },
      {
        h: "Third parties that may set their own storage",
        points: [
          "Razorpay — when you open the payment window, Razorpay sets what it needs to process and secure the transaction, under its own privacy policy.",
          "Google Fonts — used to load the typefaces on this site. It receives the request needed to serve a font file.",
          "Swiggy — if you sign in with Swiggy, that sign-in happens on Swiggy's own domain under Swiggy's own policies.",
        ],
      },
      {
        h: "Your choices",
        p: "You can clear this data at any time through your browser settings, and block cookies entirely if you prefer. Note that blocking the strictly necessary items above will sign you out and prevent orders from being placed, because the Platform has no other way to recognise your session.",
      },
      {
        h: "Questions",
        p: `Write to ${CONTACT.privacyEmail}.`,
      },
    ],
  },

  grievance: {
    title: "Grievance Redressal",
    numbered: true,
    intro:
      "If something has gone wrong, this page tells you exactly who to contact, what we will do, and by when. These timelines are obligations under the Consumer Protection (E-Commerce) Rules, 2020, the Information Technology Act, 2000, and the Digital Personal Data Protection Act, 2023 — not targets.",
    sections: [
      {
        h: "Grievance Officer",
        points: [
          `Name: ${GRIEVANCE_OFFICER.name}`,
          `Designation: ${GRIEVANCE_OFFICER.designation}`,
          `Email: ${GRIEVANCE_OFFICER.email}`,
          `Phone: ${GRIEVANCE_OFFICER.phone} (${CONTACT.hours})`,
          `Address: ${COMPANY.legalName}, ${formattedAddress()}`,
        ],
      },
      {
        h: "What we commit to",
        points: [
          `We acknowledge every complaint within ${GRIEVANCE_OFFICER.acknowledgeHours} hours of receiving it.`,
          `We aim to resolve it within ${GRIEVANCE_OFFICER.resolveDays} days.`,
          "We will tell you the outcome and the reasoning, not just that the ticket is closed.",
        ],
      },
      {
        h: "Where to raise which complaint",
        points: [
          "FOOD QUALITY, SAFETY, OR A MISSING ITEM on a CaterBox or event order: contact us. The assigned Vendor is responsible for resolution, and we will coordinate with them on your behalf. Please write within 2 hours of delivery with photographs where possible.",
          "ANYTHING ABOUT A SWIGGY GROUP ORDER: raise it with Swiggy or the restaurant through the Swiggy app. That order sits on your own Swiggy account and was paid through Swiggy, so they hold the order and the money — CaterKart cannot cancel or refund it. We will help you work out what happened if you ask.",
          "PAYMENTS, REFUNDS, OR BILLING on an order paid to CaterKart: contact us directly.",
          "YOUR PERSONAL DATA — access, correction, erasure, or withdrawing consent: write to the Grievance Officer with \"Data request\" in the subject line.",
          "A SECURITY VULNERABILITY: please write to " + CONTACT.securityEmail + " rather than filing a public report, so we can fix it before it is exploited.",
        ],
      },
      {
        h: "If you are not satisfied with our response",
        points: [
          "For consumer disputes, you may approach the National Consumer Helpline (1915 or consumerhelpline.gov.in) or the appropriate Consumer Disputes Redressal Commission.",
          "For personal-data complaints, you may escalate to the Data Protection Board of India once you have given us the opportunity to respond.",
          "Nothing on this page limits any remedy available to you under applicable law.",
        ],
      },
    ],
  },
};

const DOC_PATHS = {
  privacy: "/privacy-policy",
  shipping: "/shipping-policy",
  cookies: "/cookie-policy",
  grievance: "/grievance-redressal",
  terms: "/terms",
  refund: "/refund-policy",
};

export default function LegalPage({ doc = "privacy" }) {
  const data = DOCS[doc] || DOCS.privacy;

  return (
    <Wrapper headertext="CaterKart" headerLeftType="back" footer>
      <Seo
        title={data.title}
        description={data.intro}
        path={DOC_PATHS[doc] || DOC_PATHS.privacy}
      />

      <article className="legal">
        <h1 className="legal__title">{data.title}</h1>
        <p className="legal__updated">Last updated: {UPDATED}</p>
        <p className="legal__intro">{data.intro}</p>

        {data.sections.map((s, i) => (
          <section className="legal__section" key={s.h}>
            <h2 className="legal__h">{data.numbered ? `${i + 1}. ` : ""}{s.h}</h2>
            {s.p && <p className="legal__p">{s.p}</p>}
            {Array.isArray(s.points) && (
              <ul className="legal__list">
                {s.points.map((pt, j) => <li key={j}>{pt}</li>)}
              </ul>
            )}
          </section>
        ))}

        <section className="legal__section">
          <h2 className="legal__h">{data.numbered ? `${data.sections.length + 1}. ` : ""}Contact us</h2>
          <p className="legal__p">
            Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or call{" "}
            <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}>{SUPPORT_PHONE}</a>.
          </p>
          {doc === "terms" && (
            <p className="legal__p" style={{ marginTop: 8 }}>
              <strong>Grievance Officer:</strong> Grievance Redressal Team, CaterKart<br />
              Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · Phone:{" "}
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}>{SUPPORT_PHONE}</a><br />
              Address: Bengaluru, Karnataka, India
            </p>
          )}
        </section>
      </article>
    </Wrapper>
  );
}
