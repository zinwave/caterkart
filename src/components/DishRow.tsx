import { useState } from 'react';
import { Dish } from '../data/mock';

export default function DishRow({
  dish,
  onAdd,
}: {
  dish: Dish;
  onAdd: () => void;
}) {
  const [bumped, setBumped] = useState(false);

  function handleAdd() {
    setBumped(true);
    onAdd();
    setTimeout(() => setBumped(false), 350);
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-3.5 h-3.5 border-[1.5px] grid place-items-center ${dish.veg ? 'border-swiggy-green' : 'border-swiggy-red'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dish.veg ? 'bg-swiggy-green' : 'bg-swiggy-red'}`} />
          </span>
          {dish.bestseller && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              ⭐ Bestseller
            </span>
          )}
        </div>
        <div className="font-semibold leading-tight mt-1">{dish.name}</div>
        <div className="text-sm text-neutral-700 mt-0.5 font-medium">₹{dish.price}</div>
        {dish.description && (
          <div className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{dish.description}</div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-50 to-rose-50 grid place-items-center text-4xl shadow-card transition-transform ${bumped ? 'scale-95' : ''}`}>
          {dish.imageEmoji}
        </div>
        <button
          onClick={handleAdd}
          className={`-mt-3 px-4 py-1.5 rounded-lg bg-white border-2 border-swiggy-green text-swiggy-green text-sm font-bold shadow-card hover:bg-green-50 active:scale-95 transition-all ${bumped ? 'animate-pop' : ''}`}
        >
          ADD +
        </button>
      </div>
    </div>
  );
}
