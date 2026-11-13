// src/pages/createSubscription/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Seo from "../../../components/Seo";
import BoxLayoutIcon from "../../components/boxLayoutIcon";
import OTPModal from "../../components/otpModal";
// load SubscriptionModal.scss BEFORE packagingOptions to keep a single, consistent
// CSS order across the app (matches create-menu) — avoids mini-css "conflicting order".
import "../create-menu/components/SubscriptionModal.scss"; // shared .sub* field styles
import PackagingOptions from "../../components/packagingOptions";
import cobrand3 from "../../assets/cobrand3.png";
import cobrand5 from "../../assets/cobrand5.png";
import cobrand8 from "../../assets/cobrand8.png";
import { carrierSavingPerBox, CO_BRAND_PRICE, BIODEGRADABLE_PRICE } from "../../services/pricing";
import { createSubscription } from "../../services/subscriptions";
import { fetchCombos } from "../../services/combos";
import { checkServiceability } from "../../services/pincodes";
import { sendOTP, verifyOTP } from "../../services/otp";

const MEALS = ["Breakfast", "Lunch/Dinner", "Snacks"];
const BOXES = [3, 8]; // 5-item box paused for now — we serve 3 & 8
const COBRAND_IMG = { 3: cobrand3, 5: cobrand5, 8: cobrand8 };
const FREQUENCIES = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "custom", label: "Custom" },
];

const newKey = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// "2026-06-22" -> "22 Jun 2026" for friendly hints.
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const mealFromSlot = (slot) => {
  const s = String(slot || "").trim();
  return MEALS.includes(s) ? s : "";
};

// Names of the dishes packed in a combo (fixed dishes + choosable slots).
const comboDishNames = (c) =>
  (Array.isArray(c?.items) ? c.items : [])
    .map((it) => (it?.kind === "choice" ? (it.label || "Your choice") : (it?.name || "")))
    .filter(Boolean);

export default function CreateSubscriptionPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const ctxMealSlot = state?.mealSlot;
  const ctxBoxType = state?.boxType;

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [pincode, setPincode] = useState("");
  const [meal, setMeal] = useState(mealFromSlot(ctxMealSlot) || "Lunch/Dinner");
  const [box, setBox] = useState(BOXES.includes(Number(ctxBoxType)) ? Number(ctxBoxType) : 3);
  const [totalMeals, setTotalMeals] = useState("");
  const [endDate, setEndDate] = useState(""); // blank = ongoing (no end date) by default
  const ongoing = !endDate;
  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState("");
  // We need at least 1 week lead time to confirm & schedule a subscription.
  const minStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const [reusableCarrier, setReusableCarrier] = useState(false);
  const [coBranded, setCoBranded] = useState(false); // customized packaging (+₹/box)
  const [biodegradable, setBiodegradable] = useState(false); // compostable eco packaging (+₹/box)
  const [preferredCombos, setPreferredCombos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [combosLoading, setCombosLoading] = useState(false);
  const [pinCheck, setPinCheck] = useState(null); // { checking, serviceable, area, notConfigured }
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const keyRef = useRef(newKey());
  const pendingRef = useRef(null);

  // Inline serviceability check once a full 6-digit pincode is entered.
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) { setPinCheck(null); return; }
    let alive = true;
    setPinCheck({ checking: true });
    checkServiceability(pincode)
      .then((r) => { if (alive) setPinCheck({ checking: false, ...r }); })
      .catch(() => { if (alive) setPinCheck(null); });
    return () => { alive = false; };
  }, [pincode]);

  // Load combos matching the chosen meal + box size so the customer can mark
  // preferences relevant to their plan.
  useEffect(() => {
    let alive = true;
    setCombosLoading(true);
    const params = {};
    if (box) params.boxType = box;
    if (meal) params.mealSlot = meal;
    fetchCombos(params)
      .then((list) => { if (alive) setCombos(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setCombos([]); })
      .finally(() => { if (alive) setCombosLoading(false); });
    return () => { alive = false; };
  }, [box, meal]);

  const carrierOff = carrierSavingPerBox(box); // ₹ off per box by size when reusable
  const cleanPhone = () => phone.replace(/\D/g, "").slice(-10);
  const toggleCombo = (name) =>
    setPreferredCombos((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  // Step 1 — validate, then send an OTP to the contact number.
  const requestOtp = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const next = {};
    if (!contactName.trim()) next.contactName = "Please enter your name.";
    if (!/^\d{10}$/.test(cleanPhone())) next.phone = "Enter a valid 10-digit phone number.";
    if (!/^\d{6}$/.test(pincode)) next.pincode = "Enter a valid 6-digit pincode.";
    if (!startDate) next.startDate = "Please pick a start date.";
    else if (startDate < minStartDate) next.startDate = "We need at least 1 week to schedule — pick a later date.";
    if (endDate && endDate < startDate) next.endDate = "End date can't be before the start date.";
    // combo preferences are required (but not final — the team confirms them)
    if (combos.length > 0 && preferredCombos.length === 0) {
      next.combos = "Pick at least one combo you'd like.";
    }
    if (Object.keys(next).length) {
      setErrors(next);
      if (next.combos) {
        document.getElementById("subComboSection")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setErrors({});
    setSubmitError("");
    pendingRef.current = {
      contactName: contactName.trim(),
      phone: cleanPhone(),
      email: email.trim() || undefined,
      organisation: organisation.trim() || undefined,
      pincode,
      mealSlot: meal || undefined,
      boxType: box || undefined,
      totalMeals: totalMeals ? Number(totalMeals) : undefined,
      frequency: frequency || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      ongoing, // true when no end date — runs until cancelled; billing is weekly
      reusableCarrier,
      coBranded,
      biodegradable,
      preferredCombos: preferredCombos.length ? preferredCombos : undefined,
      notes: notes.trim() || undefined,
      discountPct: 0,
      idempotencyKey: keyRef.current,
    };

    setSubmitting(true);
    try {
      await sendOTP(cleanPhone());
      setShowOtp(true);
    } catch (err) {
      console.error("subscription OTP send failed", err);
      setSubmitError(err?.response?.data?.message || err?.message || "Couldn't send OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 — verify the OTP, then create the subscription enquiry.
  const verifyAndSubmit = async (otp) => {
    if (verifying) return;
    setVerifying(true);
    setSubmitError("");
    try {
      await verifyOTP(cleanPhone(), otp);
      await createSubscription(pendingRef.current);
      setShowOtp(false);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("subscription verify/submit failed", err);
      setShowOtp(false);
      setSubmitError(err?.response?.data?.message || err?.message || "Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const firstName = contactName.trim().split(" ")[0];

  /* ── Success ───────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-surface-secondary">
        <Seo
          title="CaterBox Meal Box Subscription"
          description="Subscribe to CaterBox — fresh, chef-prepared meal boxes delivered on a schedule that suits you, in reusable carriers across Bangalore."
          path="/caterbox-subscription"
        />
        <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-5 py-16">
          <div className="wcard w-full p-7 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-green-50 text-swiggy-green">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <h1 className="font-display text-[22px] font-black tracking-tight text-ink-primary">Request received</h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-secondary">
              Thanks{firstName ? `, ${firstName}` : ""} — our team will call you on{" "}
              <strong className="text-ink-primary">+91 {cleanPhone()}</strong> to confirm the plan
              and send a tailored quote.
            </p>
            <Link to="/" className="wbtn mt-6 w-full py-3.5 text-[15px]">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-surface-secondary">
      <Seo
        title="CaterBox Meal Box Subscription"
        description="Subscribe to CaterBox — fresh, chef-prepared meal boxes delivered on a schedule that suits you, in reusable carriers across Bangalore."
        path="/caterbox-subscription"
        keywords="meal box subscription Bangalore, CaterBox, daily meal delivery, tiffin subscription Bengaluru"
      />

      {/* Inner page, arrived at from CaterBox — a back-link, not a hero. */}
      <div className="sticky top-0 z-40 border-b border-line-subtle bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-5">
          <Link to="/caterbox" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-secondary transition hover:text-swiggy-orange">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            CaterBox
          </Link>
          <span className="text-line-default">/</span>
          <span className="text-[13.5px] font-bold text-ink-primary">Subscription</span>
          <span className="chip chip-green ml-auto hidden sm:inline-flex">Weekly billing</span>
        </div>
      </div>

      <form onSubmit={requestOtp} className="mx-auto max-w-6xl px-4 pb-28 pt-7 sm:px-5 lg:pb-16">
        <header className="mb-7 max-w-2xl">
          <h1 className="font-display text-[clamp(24px,5vw,34px)] font-black leading-[1.12] tracking-[-0.028em] text-ink-primary">
            CaterBox subscription
          </h1>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-secondary">
            The same box on a regular schedule. Tell us a few details and we&rsquo;ll come back with
            a tailored quote at bulk pricing.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[["💸", "Bulk pricing"], ["🗓️", "Weekly billing"], ["✋", "Cancel anytime"]].map(([i, t]) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-secondary shadow-card">
                <span aria-hidden="true">{i}</span> {t}
              </span>
            ))}
          </div>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">

            {/* 1 — Your details */}
            <SubCard n={1} title="Your details">
              <div className="grid gap-4 sm:grid-cols-2">
                <SubField label="Name" required error={errors.contactName}>
                  <input className={subInput(errors.contactName)} placeholder="Full name"
                    value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </SubField>

                <SubField label="Phone" required error={errors.phone}>
                  <div className={`flex items-stretch overflow-hidden rounded-xl border-[1.5px] bg-white transition focus-within:border-swiggy-orange ${errors.phone ? "border-swiggy-red" : "border-line-default"}`}>
                    <span className="grid place-items-center border-r border-line-subtle bg-surface-secondary px-3 text-[14px] font-bold text-ink-secondary">+91</span>
                    <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile"
                      className="w-full bg-transparent px-3.5 py-3 text-[15px] tabular-nums outline-none"
                      value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </div>
                </SubField>

                <SubField label="Delivery pincode" required error={errors.pincode}>
                  <input type="tel" inputMode="numeric" maxLength={6} placeholder="560001"
                    className={`${subInput(errors.pincode)} tabular-nums`}
                    value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  <div className="mt-2 min-h-[18px] text-[12.5px]">
                    {pinCheck?.checking && (
                      <span className="inline-flex items-center gap-1.5 text-ink-tertiary">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-default border-t-swiggy-orange" />
                        Checking serviceability…
                      </span>
                    )}
                    {pinCheck && !pinCheck.checking && !pinCheck.notConfigured && (
                      pinCheck.serviceable
                        ? <span className="font-semibold text-swiggy-green">✓ We deliver to {pinCheck.area}</span>
                        : <span className="font-semibold text-swiggy-red">We don&rsquo;t deliver here yet — our team will confirm options.</span>
                    )}
                  </div>
                </SubField>

                <SubField label="Email" optional>
                  <input type="email" className={subInput()} placeholder="you@company.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </SubField>

                <SubField label="Organisation" optional className="sm:col-span-2">
                  <input className={subInput()} placeholder="Company / office name"
                    value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
                </SubField>
              </div>
            </SubCard>

            {/* 2 — Your plan */}
            <SubCard n={2} title="Your plan">
              <SubLabel>Meal</SubLabel>
              <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Meal">
                {MEALS.map((m) => (
                  <SubChip key={m} on={meal === m} onClick={() => setMeal(m)}>{m}</SubChip>
                ))}
              </div>

              <SubLabel>{reusableCarrier ? "Carrier size" : "Box size"}</SubLabel>
              <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Box size">
                {BOXES.map((b) => {
                  const active = box === b;
                  return (
                    <button key={b} type="button" aria-pressed={active} onClick={() => setBox(b)}
                      className={`relative flex items-center gap-3.5 rounded-xl border-2 p-3.5 text-left transition active:scale-[0.98] ${
                        active ? "border-swiggy-orange bg-orange-50/60 shadow-pop" : "border-line-default bg-white hover:border-orange-200"
                      }`}>
                      {!reusableCarrier && (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white">
                          {coBranded
                            ? <img src={COBRAND_IMG[b]} alt="" aria-hidden="true" loading="lazy" className="h-16 w-16 object-contain" />
                            : <BoxLayoutIcon size={b} className="h-14 w-14" />}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-bold text-ink-primary">
                          {reusableCarrier ? `${b} items` : `${b}-item box`}
                        </span>
                        <span className="block text-[12.5px] text-ink-tertiary">
                          {b === 3 ? "Two mains and a side" : "A full spread per guest"}
                        </span>
                      </span>
                      {active && <SubTick className="absolute right-3 top-3" />}
                    </button>
                  );
                })}
              </div>

              <SubLabel>Packaging</SubLabel>
              <PackagingOptions
                value={coBranded ? "cobrand" : biodegradable ? "biodegradable" : reusableCarrier ? "carrier" : "plain"}
                onChange={(v) => { setReusableCarrier(v === "carrier"); setCoBranded(v === "cobrand"); setBiodegradable(v === "biodegradable"); }}
                boxType={box}
                label=""
              />
            </SubCard>

            {/* 3 — Combos */}
            <SubCard n={3} title="Combos you'd like" required id="subComboSection">
              <p className="mb-4 text-[13px] leading-relaxed text-ink-secondary">
                Pick the boxes you&rsquo;d like. This isn&rsquo;t final — our team will confirm with you,
                then rotate through your favourites across deliveries.
                {reusableCarrier && carrierOff > 0 && <strong className="text-swiggy-green"> ₹{carrierOff} off each with reusable carriers.</strong>}
                {coBranded && <strong className="text-ink-primary"> +₹{CO_BRAND_PRICE}/box for customized packaging.</strong>}
                {biodegradable && <strong className="text-ink-primary"> +₹{BIODEGRADABLE_PRICE}/box for biodegradable packaging.</strong>}
              </p>

              {combosLoading ? (
                <div className="flex flex-col gap-2.5">
                  {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-tertiary" />)}
                </div>
              ) : combos.length === 0 ? (
                <div className="rounded-xl border border-line-default bg-surface-secondary px-4 py-3.5 text-[13.5px] text-ink-secondary">
                  No combos to show for {meal || "this meal"}{box ? ` · ${box}-item box` : ""} yet.
                  You can continue and we&rsquo;ll suggest options.
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {combos.map((c) => {
                    const name = c.name || "Combo";
                    const active = preferredCombos.includes(name);
                    const dishes = comboDishNames(c);
                    const extras = [...(c.commonItems || []), ...((c.addOns || []).map((a) => a?.name).filter(Boolean))];
                    return (
                      <button key={c._id || name} type="button" aria-pressed={active} onClick={() => toggleCombo(name)}
                        className={`relative rounded-xl border-2 p-3.5 text-left transition active:scale-[0.99] ${
                          active ? "border-swiggy-orange bg-orange-50/60 shadow-pop" : "border-line-default bg-white hover:border-orange-200"
                        }`}>
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-bold leading-snug text-ink-primary">{name}</span>
                          {c.price ? (
                            <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-ink-primary">
                              {reusableCarrier && carrierOff > 0 ? (
                                <>
                                  <s className="mr-1 font-medium text-ink-disabled">₹{c.price}</s>
                                  <span className="text-swiggy-green">₹{Math.max(0, c.price - carrierOff)}</span>
                                </>
                              ) : coBranded ? `₹${c.price + CO_BRAND_PRICE}`
                                : biodegradable ? `₹${c.price + BIODEGRADABLE_PRICE}`
                                : `₹${c.price}`}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-[12px] text-ink-tertiary">
                          {[c.boxType ? `${c.boxType}-item box` : "", c.mealSlot, c.vendor].filter(Boolean).join(" · ")}
                        </span>
                        {dishes.length > 0 && (
                          <span className="mt-1.5 block text-[12.5px] leading-snug text-ink-secondary">
                            {dishes.slice(0, 5).join(", ")}{dishes.length > 5 ? ` +${dishes.length - 5} more` : ""}
                          </span>
                        )}
                        {extras.length > 0 && (
                          <span className="mt-1 block text-[12px] text-ink-tertiary">Includes: {extras.slice(0, 4).join(", ")}</span>
                        )}
                        {active && <SubTick className="absolute -right-1.5 -top-1.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {preferredCombos.length > 0 && (
                  <span className="chip chip-orange">{preferredCombos.length} selected</span>
                )}
                {errors.combos && <span className="text-[12.5px] font-medium text-swiggy-red">{errors.combos}</span>}
              </div>
            </SubCard>

            {/* 4 — Quantity & schedule */}
            <SubCard n={4} title="Quantity & schedule">
              <div className="grid gap-4 sm:grid-cols-2">
                <SubField label="Number of meals" hint="Meals per delivery">
                  <input type="number" min="1" inputMode="numeric" placeholder="e.g. 30"
                    className={`${subInput()} tabular-nums`}
                    value={totalMeals} onChange={(e) => setTotalMeals(e.target.value)} />
                </SubField>

                <SubField label="Delivery frequency">
                  <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Frequency">
                    {FREQUENCIES.map((f) => (
                      <SubChip key={f.id} on={frequency === f.id} onClick={() => setFrequency(f.id)}>{f.label}</SubChip>
                    ))}
                  </div>
                </SubField>

                <SubField
                  label="Start date" required error={errors.startDate}
                  hint={`Earliest is ${fmtDate(minStartDate)} — we need ~1 week to schedule.`}
                >
                  <input type="date" min={minStartDate} className={subInput(errors.startDate)}
                    value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </SubField>

                <SubField
                  label="End date" optional error={errors.endDate}
                  hint={ongoing ? "Leave blank — runs until you cancel." : "Plan ends on this date."}
                >
                  <input type="date" min={startDate || minStartDate} className={subInput(errors.endDate)}
                    value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </SubField>
              </div>

              <p className="mt-4 rounded-xl bg-surface-secondary px-4 py-3 text-[12.5px] leading-relaxed text-ink-secondary">
                Billed weekly — one invoice per week.{" "}
                {ongoing ? "No end date: it continues until you cancel." : "Runs from the start until the end date you picked."}
              </p>
            </SubCard>

            {/* Notes */}
            <SubCard n={5} title="Anything else?" optional>
              <textarea rows={3} placeholder="Preferences, delivery window, dietary notes…"
                className={`${subInput()} resize-y`}
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </SubCard>
          </div>

          {/* Summary rail */}
          <aside className="lg:sticky lg:top-20">
            <div className="wcard p-5">
              <div className="mb-4 font-display text-[17px] font-bold tracking-tight text-ink-primary">
                Your plan
              </div>
              <dl className="flex flex-col gap-2.5 text-[13.5px]">
                <SubRow k="Meal" v={meal} />
                <SubRow k={reusableCarrier ? "Carrier" : "Box"} v={`${box} items`} />
                <SubRow k="Packaging" v={coBranded ? "Customised" : biodegradable ? "Biodegradable" : reusableCarrier ? "Reusable carriers" : "Standard"} />
                <SubRow k="Frequency" v={FREQUENCIES.find((f) => f.id === frequency)?.label || "—"} />
                <SubRow k="Per delivery" v={totalMeals ? `${totalMeals} meals` : "—"} />
                <SubRow k="Starts" v={startDate ? fmtDate(startDate) : "—"} />
                <SubRow k="Ends" v={ongoing ? "Ongoing" : fmtDate(endDate)} />
                <SubRow k="Combos" v={preferredCombos.length ? `${preferredCombos.length} picked` : "None yet"} />
              </dl>

              {submitError && (
                <div role="alert" className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[13px] font-medium text-swiggy-red">
                  {submitError}
                </div>
              )}

              <button type="submit" disabled={submitting} className="wbtn mt-5 hidden w-full py-3.5 text-[15px] lg:flex">
                {submitting ? "Sending OTP…" : "Get quote"}
              </button>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-tertiary">
                No payment now — we verify your number with an OTP, then send a tailored quote.
              </p>
            </div>
          </aside>
        </div>

        {/* Docked action bar — the rail is far below the form on a phone. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-ink-primary">{meal} · {box} items</div>
              <div className="truncate text-[12px] text-ink-tertiary">
                {FREQUENCIES.find((f) => f.id === frequency)?.label}
                {startDate ? ` · from ${fmtDate(startDate)}` : ""}
              </div>
            </div>
            <button type="submit" disabled={submitting} className="wbtn shrink-0 px-5 py-3 text-[14.5px]">
              {submitting ? "Sending…" : "Get quote"}
            </button>
          </div>
        </div>
      </form>

      <OTPModal
        showModal={showOtp}
        phone={cleanPhone()}
        loading={verifying}
        onClose={() => { if (!verifying) setShowOtp(false); }}
        onSubmit={verifyAndSubmit}
      />
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────── */

const subInput = (err) =>
  `w-full rounded-xl border-[1.5px] bg-white px-3.5 py-3 text-[15px] text-ink-primary outline-none transition ${
    err ? "border-swiggy-red" : "border-line-default focus:border-swiggy-orange"
  }`;

function SubCard({ n, title, required, optional, id, children }) {
  return (
    <section id={id} className="wcard p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-swiggy-orange text-[12.5px] font-bold text-white">
          {n}
        </span>
        <h2 className="font-display text-[16.5px] font-bold tracking-tight text-ink-primary">
          {title}{required && <span className="ml-1 text-swiggy-red">*</span>}
        </h2>
        {optional && <span className="chip">Optional</span>}
      </div>
      {children}
    </section>
  );
}

function SubLabel({ children }) {
  return <span className="mb-2 block text-[12.5px] font-semibold text-ink-secondary">{children}</span>;
}

function SubField({ label, required, optional, hint, error, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-secondary">
        {label}
        {required && <span className="ml-0.5 text-swiggy-red">*</span>}
        {optional && <span className="ml-1 font-medium text-ink-disabled">(optional)</span>}
      </span>
      {children}
      {error
        ? <span className="mt-1.5 block text-[12px] font-medium text-swiggy-red">{error}</span>
        : hint ? <span className="mt-1.5 block text-[12px] text-ink-tertiary">{hint}</span> : null}
    </label>
  );
}

function SubChip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`rounded-full border-[1.5px] px-4 py-2.5 text-[14px] transition active:scale-[0.96] ${
        on ? "border-swiggy-orange bg-orange-50 font-bold text-swiggy-orange"
           : "border-line-default font-medium text-ink-secondary hover:border-orange-200 hover:text-ink-primary"
      }`}>
      {children}
    </button>
  );
}

function SubTick({ className = "" }) {
  return (
    <span className={`grid h-5 w-5 place-items-center rounded-full bg-swiggy-orange text-white ${className}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
    </span>
  );
}

function SubRow({ k, v }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-ink-tertiary">{k}</dt>
      <dd className="ml-auto text-right font-semibold text-ink-primary">{v}</dd>
    </div>
  );
}
