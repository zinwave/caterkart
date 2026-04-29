import { Member } from '../data/mock';

export function MemberAvatar({ m, size = 28, ring }: { m: Member; size?: number; ring?: boolean }) {
  return (
    <div
      title={m.name}
      className={`${m.color} grid place-items-center rounded-full text-white font-semibold ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {m.initials}
    </div>
  );
}

export function MemberStack({ ms, size = 26 }: { ms: Member[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {ms.map((m) => (
        <MemberAvatar key={m.id} m={m} size={size} ring />
      ))}
    </div>
  );
}
