import { FormEvent, useState } from 'react';
import { useSwiggy } from '../state/SwiggyContext';
import { Select } from './common';
import { ADDRESS_CATEGORIES, type AddressCategory } from '../lib/mcp/types';
import { IconMapPin } from './icons/Icons';

/**
 * Saves a delivery address to the user's REAL Swiggy account.
 *
 * This exists because Swiggy added `create_address` to the MCP: before it, the
 * only way to get an address was the Swiggy app, so a newly created account
 * landed here with nothing and every address-gated tool was unreachable.
 *
 * The fields mirror Swiggy's `required` list exactly. They are asked for
 * separately rather than parsed out of one blob because a wrong split produces
 * a successfully-saved address that delivers to the wrong place — the field
 * Swiggy geocodes is `fullAddress`, and the rest is what a rider reads.
 */
const inputCls =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-line-default bg-white outline-none focus:ring-2 focus:ring-swiggy-orange/30 focus:border-swiggy-orange transition';

const CATEGORY_LABELS: Record<AddressCategory, string> = {
  HOME: 'Home',
  WORK: 'Work',
  OFFICE: 'Office',
  FRIENDS_AND_FAMILY: 'Friends & family',
  OTHER: 'Other',
};

export default function AddAddressForm({ onDone }: { onDone?: () => void }) {
  const { createAddress } = useSwiggy();

  const [fullAddress, setFullAddress] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [category, setCategory] = useState<AddressCategory>('HOME');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors the server DTO. Validating here too keeps a typo from costing a
  // round-trip that ends in a generic 400.
  const pinOk = /^[1-9][0-9]{5}$/.test(postalCode);
  const phoneOk = /^(?:\+?91)?[6-9][0-9]{9}$/.test(userPhone.replace(/[\s-]/g, ''));
  const canSave =
    fullAddress.trim().length >= 5 &&
    addressLine.trim() &&
    city.trim() &&
    pinOk &&
    userName.trim() &&
    phoneOk &&
    !saving;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createAddress({
        fullAddress: fullAddress.trim(),
        addressLine: addressLine.trim(),
        // Swiggy wants the key present even when there is nothing to put in it.
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        addressCategory: category,
        userName: userName.trim(),
        userPhone: userPhone.replace(/[\s-]/g, ''),
        addressTag: CATEGORY_LABELS[category],
      });
      onDone?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save that address on Swiggy. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Full address" hint="Exactly as you'd write it for a rider">
        <textarea
          value={fullAddress}
          onChange={(e) => setFullAddress(e.target.value)}
          rows={2}
          placeholder="221B Brigade Road, Ashok Nagar, Bengaluru 560025"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Building / street">
          <input
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder="221B Brigade Road"
            className={inputCls}
          />
        </Field>
        <Field label="Flat / floor" optional>
          <input
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="3rd floor"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Bengaluru"
            className={inputCls}
          />
        </Field>
        <Field label="PIN code" error={postalCode.length > 0 && !pinOk ? '6 digits' : undefined}>
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="560025"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Address type">
        <Select
          value={category}
          onChange={(v) => setCategory(v as AddressCategory)}
          title="Address type"
          icon={<IconMapPin size={15} />}
          options={ADDRESS_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Your name">
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Dhanush"
            className={inputCls}
          />
        </Field>
        <Field
          label="Phone"
          error={userPhone.length > 0 && !phoneOk ? 'Invalid number' : undefined}
        >
          <input
            value={userPhone}
            onChange={(e) => setUserPhone(e.target.value)}
            inputMode="tel"
            placeholder="9876543210"
            className={inputCls}
          />
        </Field>
      </div>

      {error && (
        <p className="text-xs font-semibold text-swiggy-red bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSave} className="btn-primary w-full disabled:opacity-50">
        {saving ? 'Saving to Swiggy…' : 'Save address'}
      </button>
      <p className="text-[11px] text-ink-tertiary text-center">
        This is saved to your real Swiggy account, the same as adding it in their app.
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5 mb-1">
        <span className="text-xs font-bold text-ink-secondary">{label}</span>
        {optional && <span className="text-[10px] text-ink-tertiary">optional</span>}
        {error && <span className="text-[10px] font-semibold text-swiggy-red">{error}</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-ink-tertiary mt-1">{hint}</span>}
    </label>
  );
}
