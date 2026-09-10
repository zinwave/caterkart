import { useState } from 'react';
import type { Restaurant } from '../lib/mcp/types';
import { IconHeart, IconHeartFill, IconBolt, IconStar, IconClock } from './icons/Icons';

type Props = {
  r: Restaurant;
  onClick?: () => void;
  variant?: 'hero' | 'compact';
  matchedDishes?: string[]; // dish names that matched a search query
};

// =====================================================
// Swiggy-style restaurant card — real Swiggy imagery,
// ratings, ETA and cost-for-two.
// "hero" — image-first vertical card (default)
// "compact" — horizontal small card (for "selected" lists)
// =====================================================
export default function RestaurantCard({ r, onClick, variant = 'hero', matchedDishes }: Props) {
  if (variant === 'compact') return <CompactCard r={r} onClick={onClick} />;
  return <HeroCard r={r} onClick={onClick} matchedDishes={matchedDishes} />;
}

/** Swiggy image, with a graceful gradient fallback when there's no imageUrl. */
export function FoodImage({
  src,
  alt,
  className = '',
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className={`bg-gradient-to-br from-orange-100 via-rose-100 to-amber-100 grid place-items-center ${className}`}
      >
        <span className="text-3xl opacity-40">🍽️</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`object-cover ${className}`}
    />
  );
}

function HeroCard({
  r,
  onClick,
  matchedDishes,
}: {
  r: Restaurant;
  onClick?: () => void;
  matchedDishes?: string[];
}) {
  const [liked, setLiked] = useState(false);
  const fast = r.etaMin > 0 && r.etaMin <= 25;

  return (
    <button
      onClick={onClick}
      className="group block w-full text-left card overflow-hidden card-hover active:scale-[0.99] transition"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <FoodImage
          src={r.imageUrl}
          alt={r.name}
          className="absolute inset-0 w-full h-full group-hover:scale-110 transition-transform duration-500"
        />

        {/* Closed overlay — Swiggy would refuse the order anyway. */}
        {!r.isOpen && (
          <div className="absolute inset-0 bg-black/60 grid place-items-center">
            <span className="text-white font-black uppercase tracking-wider text-sm">
              Currently closed
            </span>
          </div>
        )}

        {/* Real Swiggy offer strip */}
        {r.promo && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-end p-3">
            <div className="text-white">
              <div className="text-[10px] uppercase tracking-widest opacity-80 leading-none">
                Offer
              </div>
              <div className="font-black text-base leading-tight mt-0.5">{r.promo}</div>
            </div>
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setLiked((v) => !v);
          }}
          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full grid place-items-center backdrop-blur transition active:scale-90 ${
            liked ? 'bg-white text-red-500' : 'bg-white/85 text-ink-secondary hover:text-red-500'
          }`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <IconHeartFill size={18} /> : <IconHeart size={18} />}
        </button>

        {fast && r.isOpen && (
          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-md uppercase tracking-wider">
            <IconBolt size={12} /> Fast
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start gap-2">
          <h3 className="font-bold text-[15px] leading-tight flex-1 truncate">{r.name}</h3>
          <RatingPill rating={r.rating} />
        </div>

        <div className="text-xs text-ink-tertiary mt-1 truncate">{r.cuisines.join(', ')}</div>

        <div className="flex items-center gap-2 text-xs text-ink-secondary mt-1.5 font-medium">
          {r.etaMin > 0 && (
            <>
              <span className="inline-flex items-center gap-1">
                <IconClock size={14} /> {r.etaMin} mins
              </span>
              <span className="text-line-default">•</span>
            </>
          )}
          {/* Swiggy hands this over pre-formatted, e.g. "₹500 for two" */}
          <span>{r.costForTwo || '—'}</span>
        </div>

        {r.areaName && (
          <div className="text-[11px] text-ink-tertiary mt-1 truncate">
            {r.areaName}
            {r.distanceKm != null && ` · ${r.distanceKm} km`}
          </div>
        )}

        {matchedDishes && matchedDishes.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-dashed border-line-default">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-swiggy-orange mb-1.5">
              Matches your search
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matchedDishes.slice(0, 3).map((d) => (
                <span
                  key={d}
                  className="text-[11px] bg-orange-50 text-swiggy-orange px-2 py-0.5 rounded-md font-medium"
                >
                  {d}
                </span>
              ))}
              {matchedDishes.length > 3 && (
                <span className="text-[11px] text-ink-tertiary px-1">
                  +{matchedDishes.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function CompactCard({ r, onClick }: { r: Restaurant; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group card card-hover w-full text-left p-3 flex gap-3 items-center active:scale-[0.99]"
    >
      <FoodImage
        src={r.imageUrl}
        alt={r.name}
        className="w-14 h-14 rounded-xl shrink-0 group-hover:scale-105 transition-transform"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold truncate">{r.name}</div>
          <RatingPill rating={r.rating} small />
        </div>
        <div className="text-xs text-ink-tertiary truncate mt-0.5">
          {r.cuisines.join(' · ')}
          {r.etaMin > 0 && ` · ${r.etaMin} min`}
        </div>
      </div>
      <span className="text-swiggy-orange opacity-0 group-hover:opacity-100 transition-opacity text-xl">
        →
      </span>
    </button>
  );
}

/** Swiggy returns no rating for a brand-new restaurant — handle null. */
function RatingPill({ rating, small }: { rating: number | null; small?: boolean }) {
  if (rating == null) {
    return (
      <span
        className={`bg-ink-tertiary/20 text-ink-tertiary inline-flex items-center font-bold rounded ${
          small ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'
        }`}
      >
        New
      </span>
    );
  }
  const color =
    rating >= 4.4
      ? 'bg-green-700'
      : rating >= 4.0
        ? 'bg-green-600'
        : rating >= 3.5
          ? 'bg-amber-500'
          : 'bg-red-500';
  return (
    <span
      className={`${color} text-white inline-flex items-center gap-0.5 font-bold rounded ${
        small ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'
      }`}
    >
      <IconStar size={10} />
      {rating.toFixed(1)}
    </span>
  );
}
