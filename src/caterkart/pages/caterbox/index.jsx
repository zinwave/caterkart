import React, { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../../../components/Seo";
import PackagingOptions from "../../components/packagingOptions";
import box3Img from "../../assets/box3.png";
import box8Img from "../../assets/box8.png";
import { checkServiceability } from "../../services/pincodes";

// =====================================================
// CaterBox — configure the order.
//
// This is an INNER page, arrived at from the landing page, so it opens with
// a back-link and a plain page title rather than a hero: the visitor has
// already decided what they want and is here to specify it.
//
// Presentation follows the app's Swiggy design system (wcard / wbtn /
// chip-*, navy ink, Plus Jakarta) and the layout convention every food
// delivery site uses for a configure step — a scrolling column of choices
// on the left, a sticky order summary on the right that keeps the running
// total and the primary action in view.
//
// The state, validation rules and the payload handed to /create-menu are
// carried over from the original page unchanged, so the rest of the
// migrated flow behaves exactly as before.
// =====================================================

const STORAGE_KEY = "celebration-services";

// The values are what the menu and the order record expect — only the icon
// and the time hint are new, so nothing downstream had to change.
const MEALS = [
  { v: "Breakfast", icon: "🌅", hint: "7 – 10 AM" },
  { v: "Lunch/Dinner", icon: "🍛", hint: "the main meal" },
  { v: "Snacks", icon: "☕", hint: "4 – 7 PM" },
];

// Extends the original four. For CaterBox this is a label on the order —
// checkout replaces it with the packaging type — so the list is free to grow.
const OCCASIONS = [
  { v: "Birthday Party", label: "Birthday", icon: "🎂" },
  { v: "House Party", label: "House party", icon: "🏡" },
  { v: "Corporate Event", label: "Corporate", icon: "💼" },
  { v: "Kitty Party", label: "Kitty party", icon: "🫖" },
  { v: "Wedding Function", label: "Wedding", icon: "💍" },
  { v: "Housewarming", label: "Housewarming", icon: "🪔" },
  { v: "Anniversary", label: "Anniversary", icon: "❤️" },
  { v: "Baby Shower", label: "Baby shower", icon: "🍼" },
  { v: "Festival", label: "Festival", icon: "🎊" },
  { v: "Pooja / Ceremony", label: "Pooja", icon: "🙏" },
  { v: "Farewell", label: "Farewell", icon: "👋" },
  { v: "Get-together", label: "Get-together", icon: "🥳" },
];
/** 5-item box is paused; we serve 3 and 8. */
const BOX_OPTIONS = [
  { n: 3, blurb: "Two mains and a side", save: 7, img: box3Img },
  { n: 8, blurb: "A full spread per guest", save: 15, img: box8Img },
];

const PACKAGING_LABEL = {
  plain: "Standard",
  biodegradable: "Biodegradable",
  cobrand: "Customised",
  carrier: "Reusable carriers",
};

const MIN_GUESTS = 30;
const MAX_GUESTS = 500;

const validateGuests = (value) => {
  if (value === "" || value === null || value === undefined) return "Please enter guest count.";
  if (isNaN(value)) return "Guests must be a number.";
  const n = Number(value);
  if (n < MIN_GUESTS) return `Minimum booking is ${MIN_GUESTS} guests.`;
  if (n > MAX_GUESTS) return `Maximum booking is ${MAX_GUESTS} guests.`;
  return "";
};

const validatePincode = (value) => {
  if (value === "" || value === null || value === undefined) return "Please enter your pincode.";
  if (!/^\d{6}$/.test(String(value).trim())) return "Pincode must be a 6-digit number.";
  return "";
};

const DEFAULT_DIET_CONFIG = {
  dietMode: "veg-only",
  vegGuests: "",
  nonVegGuests: "0",
  kidsCount: "0",
  eventTime: "",
};

/** CaterBox needs no event date here (requireDate = false), only a valid split. */
const validateDietConfig = (cfg, total) => {
  if (cfg.dietMode === "veg+nonveg") {
    const v = Number(cfg.vegGuests || 0);
    const nv = Number(cfg.nonVegGuests || 0);
    if (!cfg.vegGuests || !cfg.nonVegGuests) return "Enter the veg / non-veg guest split.";
    if (v + nv !== Number(total)) return `Veg + Non-veg must equal ${total} guests.`;
  }
  return "";
};

export default function CaterBoxConfigure() {
  const navigate = useNavigate();

  const [selectedEvent, setSelectedEvent] = useState(OCCASIONS[0].v);
  const [guests, setGuests] = useState(50);
  const [pincode, setPincode] = useState("");
  const [errors, setErrors] = useState({});

  const [boxType, setBoxType] = useState(3);
  const [mealSlot, setMealSlot] = useState("Breakfast");
  // "plain" | "biodegradable" | "cobrand" | "carrier" — mutually exclusive,
  // the same four the menu step and the subscription flow offer.
  const [packaging, setPackaging] = useState("plain");
  const [mealError, setMealError] = useState("");
  // Live serviceability: "idle" | "checking" | "ok" | "no" | "unknown"
  const [pinCheck, setPinCheck] = useState({ status: "idle" });
  const [dietConfig, setDietConfig] = useState(DEFAULT_DIET_CONFIG);


  // Fresh start: this screen begins a new order.
  useEffect(() => { localStorage.clear(); }, []);

  // Check the pincode as soon as it is complete, rather than making people
  // press Continue to find out we do not deliver there. Debounced so a fast
  // typist does not fire six requests.
  useEffect(() => {
    if (pincode.length !== 6) { setPinCheck({ status: "idle" }); return; }
    let live = true;
    setPinCheck({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const svc = await checkServiceability(pincode);
        if (!live) return;
        if (svc.notConfigured) setPinCheck({ status: "unknown" });
        else if (svc.serviceable) setPinCheck({ status: "ok", area: svc.area, vendors: svc.vendorCount });
        else setPinCheck({ status: "no" });
      } catch {
        if (live) setPinCheck({ status: "unknown" });
      }
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [pincode]);

  // Typing one side fills the other — the two must total the headcount, so
  // making people do that arithmetic is only a way to generate errors.
  const setSplit = (field, raw) => {
    const total = Number(guests) || 0;
    const v = raw.replace(/\D/g, "");
    const other = Math.max(0, total - Number(v || 0));
    setDietConfig((c) => ({
      ...c,
      [field]: v,
      [field === "vegGuests" ? "nonVegGuests" : "vegGuests"]: v === "" ? "" : String(other),
    }));
  };

  const setGuestCount = (v) => {
    const next = v === "" ? "" : Math.min(MAX_GUESTS, Math.max(1, Number(v) || 0));
    setGuests(next);
    setErrors((p) => ({ ...p, guests: validateGuests(next) }));
  };

  const proceed = useCallback(async () => {
    const gErr = validateGuests(guests);
    const pErr = validatePincode(pincode);
    if (gErr || pErr) {
      setErrors({ guests: gErr, pincode: pErr });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Resolve the pincode to a serviceable area. A backend that is unreachable
    // or has no pincodes configured must not block the order.
    let serviceArea = dietConfig.serviceArea || "";
    try {
      const svc = await checkServiceability(String(pincode).trim());
      if (!svc.notConfigured && !svc.serviceable) {
        setErrors({ pincode: "Sorry, we don't deliver to this pincode yet." });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (svc.area) serviceArea = svc.area;
    } catch {
      /* network issue — don't block the order */
    }

    if (!boxType || !mealSlot) { setMealError("Please pick a meal and a box option."); return; }
    const cErr = validateDietConfig(dietConfig, guests);
    if (cErr) { setMealError(cErr); return; }
    setMealError("");

    try { localStorage.removeItem(STORAGE_KEY); } catch { /* quota */ }

    navigate("/create-menu", {
      state: {
        products: [],
        guests: Number(guests),
        eventType: selectedEvent,
        pincode: String(pincode).trim(),
        mealType: "caterbox",
        boxType,
        mealSlot,
        packaging,
        // Kept for the menu and checkout steps, which read this boolean.
        reusableCarrier: packaging === "carrier",
        dietConfig: { ...dietConfig, serviceArea },
        date: null,
        needMeal: true,
      },
    });
  }, [guests, pincode, boxType, mealSlot, packaging, dietConfig, navigate, selectedEvent]);

  const splitTotal = (Number(dietConfig.vegGuests) || 0) + (Number(dietConfig.nonVegGuests) || 0);
  const splitRemaining = (Number(guests) || 0) - splitTotal;
  const splitPct = {
    veg: splitTotal ? ((Number(dietConfig.vegGuests) || 0) / splitTotal) * 100 : 0,
    nonVeg: splitTotal ? ((Number(dietConfig.nonVegGuests) || 0) / splitTotal) * 100 : 0,
  };

  const blocked = !!validateGuests(guests) || !!validatePincode(pincode);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Seo
        title="CaterBox meal boxes"
        description="Individually packed meal boxes for 30 to 500 guests across Bengaluru — pick your box, add live counters and artists, and we cook and deliver."
        path="/caterbox"
      />

      {/* ── Sub-header: this is an inner page, not a front door ── */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-line-subtle">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-secondary hover:text-swiggy-orange transition"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            All options
          </Link>
          <span className="text-line-default">/</span>
          <span className="text-[13.5px] font-bold text-ink-primary">CaterBox</span>
          <span className="chip chip-navy ml-auto hidden sm:inline-flex">Delivered by our kitchen</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 pt-8 pb-16">
        <header className="mb-8 max-w-2xl">
          <h1 className="font-display font-black text-[clamp(26px,3.6vw,36px)] leading-[1.12] tracking-[-0.028em] text-ink-primary">
            Configure your meal boxes
          </h1>
          <p className="mt-2.5 text-[16px] text-ink-secondary leading-relaxed">
            Individually packed, cooked by us, delivered across Bengaluru. You&rsquo;ll pick the
            actual dishes on the next screen.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* ══ LEFT: choices ══ */}
          <div className="flex flex-col gap-5">

            {/* Occasion */}
            <Card n={1} title="What's the occasion?">
              {/* Compact inline chips rather than a tile grid: twelve tiles
                  wrapped to four rows and pushed the rest of the form down.
                  These sit on two. */}
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => {
                  const on = selectedEvent === o.v;
                  return (
                    <button
                      key={o.v} type="button" onClick={() => setSelectedEvent(o.v)} aria-pressed={on}
                      title={o.v}
                      className={`group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 py-2 transition-all duration-150 active:scale-[0.96] ${
                        on
                          ? "border-swiggy-orange bg-orange-50 shadow-pop"
                          : "border-line-default bg-white hover:border-orange-200 hover:shadow-card"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`text-[16px] leading-none transition-transform duration-150 ${on ? "scale-110" : "group-hover:scale-110"}`}
                      >
                        {o.icon}
                      </span>
                      <span className={`text-[13px] font-semibold leading-none ${on ? "text-swiggy-orange" : "text-ink-secondary"}`}>
                        {o.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card n={2} title="Guests & delivery">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Number of guests" error={errors.guests}>
                  {/* A stepper rather than a bare number field: headcount gets
                      nudged up and down far more often than it gets typed. */}
                  <div className="flex items-stretch gap-2">
                    <Stepper
                      label="Fewer guests"
                      onClick={() => setGuestCount((Number(guests) || MIN_GUESTS) - 10)}
                      disabled={(Number(guests) || 0) <= MIN_GUESTS}
                    >−</Stepper>
                    <input
                      type="number" min={MIN_GUESTS} max={MAX_GUESTS} inputMode="numeric"
                      value={guests}
                      onChange={(e) => setGuestCount(e.target.value === "" ? "" : Number(e.target.value))}
                      className={`${inputCls(errors.guests)} text-center font-bold tabular-nums`}
                    />
                    <Stepper
                      label="More guests"
                      onClick={() => setGuestCount((Number(guests) || MIN_GUESTS) + 10)}
                      disabled={(Number(guests) || 0) >= MAX_GUESTS}
                    >+</Stepper>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[50, 100, 200, 350].map((n) => (
                      <button
                        key={n} type="button" onClick={() => setGuestCount(n)}
                        aria-pressed={Number(guests) === n}
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                          Number(guests) === n
                            ? "bg-swiggy-orange text-white"
                            : "bg-surface-tertiary text-ink-secondary hover:bg-orange-50 hover:text-swiggy-orange"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Delivery pincode" error={errors.pincode}>
                  <input
                    inputMode="numeric" maxLength={6} placeholder="560038"
                    value={pincode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setPincode(v);
                      setErrors((p) => ({ ...p, pincode: validatePincode(v) }));
                    }}
                    className={`${inputCls(errors.pincode)} tabular-nums`}
                  />
                  {/* Answers "do you even deliver here?" while they type. */}
                  <div className="mt-2 min-h-[20px] text-[12.5px]">
                    {pinCheck.status === "checking" && (
                      <span className="inline-flex items-center gap-1.5 text-ink-tertiary">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-default border-t-swiggy-orange" />
                        Checking your area…
                      </span>
                    )}
                    {pinCheck.status === "ok" && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-swiggy-green">
                        <IconTick small /> We deliver to {pinCheck.area}
                        {pinCheck.vendors ? ` · ${pinCheck.vendors} kitchen${pinCheck.vendors === 1 ? "" : "s"}` : ""}
                      </span>
                    )}
                    {pinCheck.status === "no" && (
                      <span className="font-semibold text-swiggy-red">
                        We don&rsquo;t deliver to this pincode yet.
                      </span>
                    )}
                  </div>
                </Field>
              </div>

              {/* Reacts to the number above instead of restating the rules. */}
              <p className="mt-3 text-[12.5px] text-ink-tertiary">
                {Number(guests) >= MIN_GUESTS && Number(guests) <= MAX_GUESTS
                  ? `That's ${guests} individually packed boxes.`
                  : `We cook for ${MIN_GUESTS}–${MAX_GUESTS} guests, with at least 7 days' notice. Bengaluru only for now.`}
              </p>
            </Card>

            {/* Meal slot */}
            <Card n={3} title="Which meal?">
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Meal slot">
                {MEALS.map((m) => {
                  const on = mealSlot === m.v;
                  return (
                    <button
                      key={m.v} type="button" role="radio" aria-checked={on}
                      onClick={() => setMealSlot(m.v)}
                      className={`relative flex items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                        on
                          ? "border-swiggy-orange bg-orange-50 shadow-pop"
                          : "border-line-default bg-white hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-card"
                      }`}
                    >
                      <span aria-hidden="true" className={`text-[24px] leading-none transition-transform duration-150 ${on ? "scale-110" : ""}`}>
                        {m.icon}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[14.5px] font-bold ${on ? "text-swiggy-orange" : "text-ink-primary"}`}>
                          {m.v}
                        </span>
                        <span className="block text-[12px] text-ink-tertiary">{m.hint}</span>
                      </span>
                      {on && <span className="absolute right-2.5 top-2.5"><IconTick /></span>}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card n={4} title="Pick your box">
              <div className="grid sm:grid-cols-2 gap-3">
                {BOX_OPTIONS.map((b) => {
                  const on = boxType === b.n;
                  return (
                    <button
                      key={b.n} type="button" onClick={() => setBoxType(b.n)} aria-pressed={on}
                      className={`relative flex items-center gap-4 rounded-xl border-2 p-3.5 text-left transition ${
                        on ? "border-swiggy-orange bg-orange-50/60 shadow-pop" : "border-line-default bg-white hover:border-orange-200"
                      }`}
                    >
                      {/* The box you actually receive — decorative, since the
                          name beside it already says which one this is. */}
                      <img
                        src={b.img}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="h-20 w-20 shrink-0 rounded-lg bg-white object-contain"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-[15px] text-ink-primary">{b.n}-item box</span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-ink-secondary">{b.blurb}</span>
                      </span>
                      {on && <span className="absolute right-3 top-3"><IconTick /></span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[12.5px] text-ink-tertiary">
                The 5-item box is paused while we tighten the menu.
              </p>
            </Card>

            {/* Diet split */}
            {/* Packaging — the same chooser the menu step and the subscription
                flow use, so the four options and their prices stay in one
                place instead of being restated here. */}
            <Card n={5} title="Pick your packaging">
              <PackagingOptions
                value={packaging}
                onChange={setPackaging}
                boxType={boxType}
                label=""
              />
            </Card>

            <Card n={6} title="Veg or mixed?">
              <div className="flex flex-wrap gap-2 mb-4">
                <Pill on={dietConfig.dietMode === "veg-only"}
                  onClick={() => setDietConfig((c) => ({ ...c, dietMode: "veg-only" }))}>
                  Pure veg
                </Pill>
                <Pill on={dietConfig.dietMode === "veg+nonveg"}
                  onClick={() => setDietConfig((c) => ({ ...c, dietMode: "veg+nonveg" }))}>
                  Veg + non-veg
                </Pill>
              </div>

              {dietConfig.dietMode === "veg+nonveg" && (
                <>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Veg guests">
                      <input inputMode="numeric" value={dietConfig.vegGuests}
                        onChange={(e) => setSplit("vegGuests", e.target.value)}
                        className={`${inputCls()} tabular-nums`} />
                    </Field>
                    <Field label="Non-veg guests">
                      <input inputMode="numeric" value={dietConfig.nonVegGuests}
                        onChange={(e) => setSplit("nonVegGuests", e.target.value)}
                        className={`${inputCls()} tabular-nums`} />
                    </Field>
                    <Field label="Kids (optional)">
                      <input inputMode="numeric" value={dietConfig.kidsCount}
                        onChange={(e) => setDietConfig((c) => ({ ...c, kidsCount: e.target.value.replace(/\D/g, "") }))}
                        className={`${inputCls()} tabular-nums`} />
                    </Field>
                  </div>

                  {/* The split has to total the headcount, so show it adding
                      up as they type instead of failing on Continue. */}
                  <div className="mt-4">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-tertiary">
                      <div className="bg-swiggy-green transition-all duration-300" style={{ width: `${splitPct.veg}%` }} />
                      <div className="bg-swiggy-red transition-all duration-300" style={{ width: `${splitPct.nonVeg}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                        <span className="h-2 w-2 rounded-full bg-swiggy-green" />
                        {Number(dietConfig.vegGuests) || 0} veg
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                        <span className="h-2 w-2 rounded-full bg-swiggy-red" />
                        {Number(dietConfig.nonVegGuests) || 0} non-veg
                      </span>
                      <span className={`ml-auto font-semibold ${splitRemaining === 0 ? "text-swiggy-green" : "text-ink-tertiary"}`}>
                        {splitRemaining === 0
                          ? "Adds up ✓"
                          : splitRemaining > 0
                            ? `${splitRemaining} left to place`
                            : `${Math.abs(splitRemaining)} over headcount`}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </Card>


          </div>

          {/* ══ RIGHT: sticky summary ══ */}
          <aside className="lg:sticky lg:top-20">
            <div className="wcard p-5">
              <div className="font-display font-bold text-[17px] tracking-tight text-ink-primary mb-4">
                Your order
              </div>

              <dl className="flex flex-col gap-2.5 text-[13.5px]">
                <Row k="Occasion" v={selectedEvent} />
                <Row k="Guests" v={guests === "" ? "—" : `${guests}`} />
                <Row k="Meal" v={mealSlot} />
                <Row k="Box" v={`${boxType}-item`} />
                <Row k="Diet" v={dietConfig.dietMode === "veg-only" ? "Pure veg" : "Veg + non-veg"} />
                <Row k="Pincode" v={pincode || "—"} />
                <Row k="Packaging" v={PACKAGING_LABEL[packaging] || "Standard"} />
              </dl>

              {(mealError || errors.guests || errors.pincode) && (
                <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-3.5 py-3 text-[13px] text-swiggy-red font-medium">
                  {mealError || errors.guests || errors.pincode}
                </div>
              )}

              <button
                type="button"
                onClick={proceed}
                disabled={blocked}
                className="wbtn mt-5 hidden w-full py-3.5 text-[15px] lg:flex"
              >
                Choose your dishes
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>

              <p className="mt-3 text-[12px] text-ink-tertiary text-center">
                No payment yet — 50% advance is taken at checkout.
              </p>
            </div>

            {/* Same boxes, every week. Carries the meal and box already chosen
                so the subscription screen opens pre-filled. */}
            <Link
              to="/caterbox-subscription"
              state={{ mealSlot, boxType }}
              className="wcard mt-4 block p-5 transition hover:shadow-floating"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="chip chip-green">CaterBox subscription</span>
              </div>
              <div className="font-bold text-[15px] text-ink-primary">
                Feeding the same people every week?
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                Set it up once and we deliver on a schedule — weekly invoices, a
                negotiated rate, and the menu can change week to week.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-swiggy-orange">
                Set up a subscription
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </Link>
            <div className="mt-4 flex items-center gap-2.5 px-1 text-[12.5px] text-ink-tertiary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              ₹0 platform fee · ₹0 delivery fee · GST invoice
            </div>
          </aside>
        </div>
      </div>

      {/* Docked action bar — on a phone the summary rail sits far below the
          form, so without this the only way to continue is to scroll past
          every step. Mirrors the rail so the two can never disagree. */}
      <div className="sticky bottom-0 z-30 border-t border-line-subtle bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-ink-primary">
              {guests || 0} guests · {boxType}-item box
            </div>
            <div className="truncate text-[12px] text-ink-tertiary">
              {mealSlot} · {PACKAGING_LABEL[packaging] || "Standard"}
            </div>
          </div>
          <button
            type="button"
            onClick={proceed}
            disabled={blocked}
            className="wbtn shrink-0 px-5 py-3 text-[14.5px]"
          >
            Choose dishes
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────── */

const inputCls = (err) =>
  `w-full text-[15px] px-3.5 py-3 rounded-xl border-[1.5px] bg-white text-ink-primary outline-none transition ${
    err ? "border-swiggy-red" : "border-line-default focus:border-swiggy-orange"
  }`;

function Card({ n, title, optional, children }) {
  return (
    <section className="wcard p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-swiggy-orange text-white font-bold text-[12.5px]">
          {n}
        </span>
        <h2 className="font-display font-bold text-[16.5px] tracking-tight text-ink-primary">{title}</h2>
        {optional && <span className="chip">Optional</span>}
      </div>
      {children}
    </section>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on}
      className={`text-[14px] px-4 py-2.5 rounded-full border-[1.5px] font-medium transition ${
        on
          ? "border-swiggy-orange bg-orange-50 text-swiggy-orange font-bold"
          : "border-line-default text-ink-secondary hover:border-orange-200 hover:text-ink-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold text-ink-secondary mb-1.5">{label}</span>
      {children}
      {error && <span className="block mt-1.5 text-[12px] font-medium text-swiggy-red">{error}</span>}
    </label>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-ink-tertiary">{k}</dt>
      <dd className="ml-auto font-semibold text-ink-primary text-right">{v}</dd>
    </div>
  );
}

function Stepper({ children, label, onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className="grid h-[46px] w-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-line-default bg-white text-[18px] font-bold text-ink-secondary transition hover:border-swiggy-orange hover:text-swiggy-orange active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line-default disabled:hover:text-ink-secondary"
    >
      {children}
    </button>
  );
}

function IconTick({ small }) {
  if (small) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
    );
  }
  return <IconTickFull />;
}

function IconTickFull() {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-swiggy-orange text-white">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
    </span>
  );
}
