import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Common = {
  icon: ReactNode;
  label: string;
  badge?: string | number;
  dot?: boolean;
  active?: boolean;
  className?: string;
};

type AsButton = Common & { onClick?: () => void; to?: never };
type AsLink = Common & { to: string; onClick?: never };

export default function IconButton(props: AsButton | AsLink) {
  const { icon, label, badge, dot, active, className = '' } = props;

  const cls = `relative inline-grid place-items-center w-10 h-10 rounded-xl transition-all active:scale-90 ${
    active
      ? 'bg-orange-50 text-swiggy-orange ring-1 ring-orange-200'
      : 'text-neutral-700 hover:bg-orange-50 hover:text-swiggy-orange'
  } ${className}`;

  const inner = (
    <>
      {icon}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-swiggy-orange text-white text-[10px] font-black grid place-items-center ring-2 ring-white shadow-sm animate-pop">
          {badge}
        </span>
      )}
      {dot && (
        <span className="absolute top-1.5 right-1.5">
          <span className="absolute inline-flex h-2 w-2 rounded-full bg-cater-coral animate-pulse-ring" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cater-coral" />
        </span>
      )}
    </>
  );

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} aria-label={label} title={label} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      onClick={(props as AsButton).onClick}
      aria-label={label}
      title={label}
      className={cls}
    >
      {inner}
    </button>
  );
}
