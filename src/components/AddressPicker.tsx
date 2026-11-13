import { useSwiggy } from '../state/SwiggyContext';
import { Select } from './common';
import AddAddressForm from './AddAddressForm';
import { IconMapPin, IconCheck } from './icons/Icons';

/**
 * Delivery address selector — sourced from the user's REAL saved Swiggy addresses.
 *
 * This is load-bearing, not cosmetic: Swiggy derives the delivery coordinates
 * from `addressId`, and the cart/placement/order tools all require it. Nothing
 * in the app can order food until one is picked — and a newly created Swiggy
 * account starts with none, so this also has to be able to collect the first.
 */
export default function AddressPicker({ compact = false }: { compact?: boolean }) {
  const { addresses, addressId, setAddressId, loadingAddresses, connected } = useSwiggy();

  if (!connected) return null;

  if (loadingAddresses) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-tertiary">
        <span className="w-4 h-4 rounded-full border-2 border-line-default border-t-swiggy-orange animate-spin-slow" />
        Loading your Swiggy addresses…
      </div>
    );
  }

  // No saved addresses — the normal state of a freshly created Swiggy account.
  // Compact mode lives in a header strip with no room for a form, so it defers
  // to the gate; everywhere else we can just collect the address here.
  if (addresses.length === 0) {
    if (compact) {
      return <div className="text-sm text-ink-tertiary">No delivery address yet</div>;
    }
    return <AddAddressForm />;
  }

  if (compact) {
    return (
      <Select
        value={addressId}
        onChange={setAddressId}
        title="Delivery address"
        icon={<IconMapPin size={15} />}
        placeholder="Choose an address"
        searchable={addresses.length > 8}
        className="max-w-xs"
        options={addresses.map((a) => ({
          value: a.id,
          label: a.label,
          sublabel: a.display,
        }))}
      />
    );
  }

  return (
    <div className="space-y-2">
      {addresses.map((a) => {
        const active = a.id === addressId;
        return (
          <button
            key={a.id}
            onClick={() => setAddressId(a.id)}
            className={`w-full text-left card p-3.5 flex items-start gap-3 transition ${
              active
                ? 'ring-2 ring-swiggy-orange border-swiggy-orange'
                : 'card-hover hover:border-line-default'
            }`}
          >
            <span
              className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                active ? 'bg-orange-50 text-swiggy-orange' : 'bg-surface-secondary text-ink-tertiary'
              }`}
            >
              <IconMapPin size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-bold text-sm text-ink-primary">{a.label}</span>
                {active && (
                  <span className="chip chip-orange inline-flex items-center gap-1">
                    <IconCheck size={10} /> Delivering here
                  </span>
                )}
              </span>
              <span className="block text-xs text-ink-tertiary mt-0.5 line-clamp-2">{a.display}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
