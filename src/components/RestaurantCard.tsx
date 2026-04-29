import { useState } from 'react';
import { Restaurant } from '../data/mock';
import { priceForTwo } from '../utils/filters';

type Props = {
  r: Restaurant;
  onClick?: () => void;
  variant?: 'hero' | 'compact';
  matchedDishes?: string[]; // dish names that matched a search query
};

// =====================================================
// Swiggy-style restaurant card.
// "hero" — image-first vertical card (default)
// "compact" — horizontal small card (for "selected" lists)
// =====================================================
export default function RestaurantCard({ r, onClick, variant = 'hero', matchedDishes }: Props) {
  if (variant === 'compact') return <CompactCard r={r} onClick={onClick} />;
  return <HeroCard r={r} onClick={onClick} matchedDishes={matchedDishes} />;
}

function HeroCard({ r, onClick, matchedDishes }: { r: Restaurant; onClick?: () => void; matchedDishes?: string[] }) {
  const [liked, setLiked] = useState(false);
  const fast = r.etaMin <= 25;
  const p2 = priceForTwo(r);

  return (
    <button
      onClick={onClick}
      className="group block w-full text-left card overflow-hidden card-hover active:scale-[0.99] transition"
    >
      {/* Image area (gradient + emoji as faux image) */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-orange-100 via-rose-100 to-amber-100">
        {/* faint dotted pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)',
            backgroundSize: '12px 12px',
          }}
        />
        <span className="absolute inset-0 grid place-items-center text-7xl group-hover:scale-110 transition-transform duration-500">
          {r.imageEmoji}
        </span>

        {/* Promo bottom-overlay */}
        {r.promo && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-end p-3">
            <div className="text-white">
              <div className="text-[10px] uppercase tracking-widest opacity-80 leading-none">Offer</div>
              <div className="font-black text-base leading-tight mt-0.5">{r.promo}</div>
            </div>
          </div>
        )}

        {/* Top-right heart */}
        <button
          onClick={(e) => { e.stopPropagation(); setLiked((v) => !v); }}
          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full grid place-items-center backdrop-blur transition active:scale-90 ${
            liked ? 'bg-white text-red-500' : 'bg-white/85 text-neutral-700 hover:text-red-500'
          }`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <span className="text-lg leading-none">{liked ? '♥' : '♡'}</span>
        </button>

        {/* Bolt / fast badge top-left */}
        {fast && (
          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-md uppercase tracking-wider">
            ⚡ Fast
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <h3 className="font-bold text-[15px] leading-tight flex-1 truncate">{r.name}</h3>
          <RatingPill rating={r.rating} />
        </div>

        <div className="text-xs text-neutral-500 mt-1 truncate">
          {r.cuisines.join(', ')}
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-700 mt-1.5 font-medium">
          <span className="inline-flex items-center gap-1">⏱️ {r.etaMin} mins</span>
          <span className="text-neutral-300">•</span>
          <span>₹{p2} for two</span>
        </div>

        {/* Matched-dish chips when search active */}
        {matchedDishes && matchedDishes.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-dashed border-neutral-200">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-swiggy-orange mb-1.5">
              Matches your search
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matchedDishes.slice(0, 3).map((d) => (
                <span key={d} className="text-[11px] bg-orange-50 text-swiggy-orange px-2 py-0.5 rounded-md font-medium">
                  {d}
                </span>
              ))}
              {matchedDishes.length > 3 && (
                <span className="text-[11px] text-neutral-500 px-1">
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
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-3xl shrink-0 group-hover:scale-105 transition-transform">
        {r.imageEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold truncate">{r.name}</div>
          <RatingPill rating={r.rating} small />
        </div>
        <div className="text-xs text-neutral-500 truncate mt-0.5">
          {r.cuisines.join(' · ')} · {r.etaMin} min
        </div>
      </div>
      <span className="text-swiggy-orange opacity-0 group-hover:opacity-100 transition-opacity text-xl">→</span>
    </button>
  );
}

function RatingPill({ rating, small }: { rating: number; small?: boolean }) {
  const color =
    rating >= 4.4 ? 'bg-green-700' :
    rating >= 4.0 ? 'bg-green-600' :
    rating >= 3.5 ? 'bg-amber-500' :
    'bg-red-500';
  return (
    <span className={`${color} text-white inline-flex items-center gap-0.5 font-bold rounded ${small ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'}`}>
      <span className="text-[10px]">⭐</span>{rating.toFixed(1)}
    </span>
  );
}
