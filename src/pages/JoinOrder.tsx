import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DishPicker from '../components/DishPicker';
import { useCorporate, type OrderLine } from '../state/CorporateContext';
import { inr, shortDate } from '../lib/format';
import { LogoMark, IconCheck, IconArrowRight, IconUsers, IconGift, IconLock } from '../components/icons/Icons';

export default function JoinOrder() {
  const { token } = useParams();
  const {
    company, costCenters, employees, currentUser, employeeById,
    getGroupOrderByToken, signInAs, signInByEmail, joinGroupOrder, setParticipantLines, submitParticipant,
  } = useCorporate();

  const go = token ? getGroupOrderByToken(token) : undefined;
  const [identity, setIdentity] = useState<string | null>(null);

  // ── Guards ──
  if (!go) return <JoinFrame><Closed title="Link not found" body="This team-order link is invalid or has expired." /></JoinFrame>;
  if (go.status !== 'collecting') {
    return (
      <JoinFrame>
        <Closed
          title={go.status === 'placed' ? 'This order was already placed' : 'This order was cancelled'}
          body={go.status === 'placed' ? 'The organiser has finalised the order. Ask them to start a new one.' : 'The organiser cancelled this order.'}
        />
      </JoinFrame>
    );
  }

  const team = costCenters.find((c) => c.id === go.costCenterId)!;
  const organizer = employeeById(go.organizerId);
  const joinedCount = go.participants.filter((p) => p.status !== 'invited').length;

  async function choose(empId: string) {
    await signInAs(empId);
    await joinGroupOrder(go!.id, empId);
    setIdentity(empId);
  }

  // ── Login step ──
  if (!identity) {
    return (
      <JoinFrame>
        <OrderHero go={go} team={team} organizer={organizer} joinedCount={joinedCount} />
        <LoginCard
          company={company}
          currentUser={currentUser}
          employees={employees}
          onContinue={choose}
          onEmail={async (email: string) => {
            const emp = await signInByEmail(email);
            if (emp) { await joinGroupOrder(go!.id, emp.id); setIdentity(emp.id); return true; }
            return false;
          }}
        />
      </JoinFrame>
    );
  }

  // ── Pick step ──
  const me = employeeById(identity)!;
  const participant = go.participants.find((p) => p.employeeId === identity);
  const myLines = participant?.lines ?? [];
  const submitted = participant?.status === 'submitted';
  const myTotal = myLines.reduce((s, l) => s + l.price * l.qty, 0);
  const over = myTotal > go.perHeadCapRup;

  return (
    <JoinFrame>
      <OrderHero go={go} team={team} organizer={organizer} joinedCount={joinedCount} />

      {/* Who am I */}
      <div className="wcard p-3.5 mb-4 flex items-center gap-3">
        <span className={`w-9 h-9 rounded-full ${me.color} grid place-items-center text-white text-xs font-bold`}>{me.initials}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-ink-primary">{me.name}</div>
          <div className="text-[11px] text-ink-tertiary truncate">{me.workEmail}</div>
        </div>
        <button onClick={() => setIdentity(null)} className="text-[11px] font-bold text-swiggy-orange hover:underline">Not you?</button>
      </div>

      {submitted ? (
        <div className="wcard p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-100 grid place-items-center text-swiggy-green mx-auto mb-3">
            <IconCheck size={28} />
          </div>
          <h2 className="font-black text-lg text-ink-primary inline-flex items-center gap-1.5">You're all set! <IconGift size={18} /></h2>
          <p className="text-sm text-ink-secondary mt-1 max-w-sm mx-auto">
            Your picks ({inr(myTotal)}) are locked in. {organizer?.name.split(' ')[0]} will place the order once everyone's in — you can still edit until then.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <button onClick={() => setParticipantLines(go.id, identity!, myLines)} className="wbtn-soft">
              Edit my picks
            </button>
            <span className="text-[11px] text-ink-tertiary">Company-paid · nothing to pay now</span>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <h2 className="font-black text-lg text-ink-primary">Pick your meal</h2>
            <p className="text-xs text-ink-secondary">
              Up to <span className="font-bold">{inr(go.perHeadCapRup)}</span> — paid by {company.name}, no split, nothing to settle.
            </p>
          </div>

          <DishPicker
            employeeId={identity}
            vegOnly={team.vegOnly}
            perHeadCap={go.perHeadCapRup}
            lines={myLines}
            onChange={(lines: OrderLine[]) => setParticipantLines(go.id, identity!, lines)}
          />

          <div className="sticky bottom-0 mt-4 -mx-4 px-4 py-3 sticky-blur border-t border-line-default">
            <button
              onClick={() => submitParticipant(go.id, identity!)}
              disabled={myLines.length === 0 || over}
              className="wbtn w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {over ? `${inr(myTotal - go.perHeadCapRup)} over the cap` : myLines.length === 0 ? 'Add a dish to continue' : <>Submit my picks · {inr(myTotal)} <IconArrowRight size={18} /></>}
            </button>
          </div>
        </>
      )}
    </JoinFrame>
  );
}

// =====================================================
// Layout + sub-components
// =====================================================
function JoinFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="bg-ink-primary text-white">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-2.5">
          <LogoMark size={28} />
          <div className="font-black text-[15px] tracking-tight">
            Cater<span className="text-cater-coral">Kart</span>
            <span className="ml-1.5 align-middle text-[9px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-white/15">for Work</span>
          </div>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

function OrderHero({ go, team, organizer, joinedCount }: any) {
  return (
    <div className="wcard p-5 mb-4 border-orange-100">
      <div className="flex items-center gap-1.5 chip chip-orange w-max mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest">Team order</span>
      </div>
      <h1 className="text-2xl font-black tracking-tight text-ink-primary">{go.title}</h1>
      <div className="text-sm text-ink-secondary mt-1 flex flex-wrap items-center gap-x-2">
        <span>{team.emoji} {team.name}</span><span className="text-line-default">·</span>
        <span>{shortDate(go.date)}</span><span className="text-line-default">·</span>
        <span>by {organizer?.name.split(' ')[0]}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-tertiary">
        <IconUsers size={13} /> {joinedCount} teammate{joinedCount === 1 ? '' : 's'} already picking
      </div>
    </div>
  );
}

function LoginCard({ company, currentUser, employees, onContinue, onEmail }: any) {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.toLowerCase().endsWith('@' + company.emailDomain)) {
      setErr(`Use your @${company.emailDomain} work email`);
      return;
    }
    const ok = await onEmail(email);
    if (!ok) setErr('We couldn’t find that email in ' + company.name);
  }

  return (
    <div className="wcard p-5">
      <div className="wsection mb-1">Sign in to join</div>
      <p className="text-xs text-ink-secondary mb-4">
        Only <span className="font-bold">{company.name}</span> members can join. Continue as yourself or use your work email.
      </p>

      {/* Continue as current session */}
      <button
        onClick={() => onContinue(currentUser.id)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-line-default hover:border-swiggy-orange hover:bg-orange-50 transition mb-4"
      >
        <span className={`w-10 h-10 rounded-full ${currentUser.color} grid place-items-center text-white font-bold`}>{currentUser.initials}</span>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-ink-primary">Continue as {currentUser.name}</div>
          <div className="text-[11px] text-ink-tertiary">{currentUser.workEmail}</div>
        </div>
        <IconArrowRight size={18} className="text-swiggy-orange" />
      </button>

      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-line-default" />
        <span className="text-[10px] uppercase tracking-widest font-bold text-ink-tertiary">or work email</span>
        <div className="flex-1 h-px bg-line-default" />
      </div>

      <form onSubmit={submitEmail} className="flex gap-2">
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErr(''); }}
          placeholder={`you@${company.emailDomain}`}
          className="flex-1 bg-surface-secondary rounded-xl px-3.5 py-3 text-sm outline-none border border-line-default focus:border-swiggy-orange focus:ring-2 focus:ring-orange-100 transition"
        />
        <button type="submit" className="wbtn px-4">Sign in</button>
      </form>
      {err && <div className="text-[12px] text-swiggy-red font-semibold mt-2">{err}</div>}

      {/* Demo quick-pick */}
      <div className="mt-4 pt-4 border-t border-line-subtle">
        <div className="text-[10px] uppercase tracking-widest font-bold text-ink-tertiary mb-2">Demo · pick anyone</div>
        <div className="flex flex-wrap gap-1.5">
          {employees.map((e: any) => (
            <button
              key={e.id}
              onClick={() => onContinue(e.id)}
              className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-line-default hover:border-swiggy-orange hover:bg-orange-50 transition"
            >
              <span className={`w-6 h-6 rounded-full ${e.color} grid place-items-center text-white text-[10px] font-bold`}>{e.initials}</span>
              <span className="text-xs font-semibold text-ink-primary">{e.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <div className="wcard p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary grid place-items-center text-ink-tertiary mx-auto mb-3">
        <IconLock size={32} />
      </div>
      <h1 className="font-black text-lg text-ink-primary">{title}</h1>
      <p className="text-sm text-ink-secondary mt-1 max-w-sm mx-auto">{body}</p>
      <Link to="/work" className="wbtn-soft mt-4 inline-flex">Go to console</Link>
    </div>
  );
}
