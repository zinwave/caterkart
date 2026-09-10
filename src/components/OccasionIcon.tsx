import type { ComponentType, SVGProps } from 'react';
import {
  IconSparkles, IconCake, IconUsers, IconGamepad, IconFilm, IconTrophy,
  IconPlane, IconLantern, IconHome, IconHeart, IconUtensils, IconStar,
} from './icons/Icons';

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/** Event-type key → line icon. Keys come from `Occasion.icon` in data/mock. */
const MAP: Record<string, IconType> = {
  sparkles: IconSparkles,
  cake: IconCake,
  users: IconUsers,
  gamepad: IconGamepad,
  film: IconFilm,
  trophy: IconTrophy,
  plane: IconPlane,
  lantern: IconLantern,
  home: IconHome,
  heart: IconHeart,
  utensils: IconUtensils,
  star: IconStar,
};

/** Renders the icon for an occasion (falls back to a festive sparkle). */
export function OccasionIcon({
  icon,
  size = 16,
  className,
}: {
  icon?: string;
  size?: number;
  className?: string;
}) {
  const Icon = (icon && MAP[icon]) || IconSparkles;
  return <Icon size={size} className={className} />;
}
