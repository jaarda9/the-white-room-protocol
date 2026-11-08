import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight } from 'lucide-react';
import { fetchPartyState, getCachedPartyState, PARTY_UPDATED_EVENT, type PartyState } from '@/lib/party-service';
import { QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

/**
 * One line in the Daily Quest window, only for Hunters in a party: how many teammates cleared
 * today and the Bond streak. Everything else lives on the Party page.
 */
export default function PartyStrip() {
  const navigate = useNavigate();
  const [state, setState] = useState<PartyState | null>(() => getCachedPartyState());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchPartyState().then((s) => {
        if (!cancelled && s) setState(s);
      });
    load();
    // A quest completion is saved a moment later; re-read once it has had time to land.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onQuests = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 4000);
    };
    const onParty = () => setState(getCachedPartyState());
    window.addEventListener(QUESTS_UPDATED_EVENT, onQuests);
    window.addEventListener(PARTY_UPDATED_EVENT, onParty);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(QUESTS_UPDATED_EVENT, onQuests);
      window.removeEventListener(PARTY_UPDATED_EVENT, onParty);
    };
  }, []);

  const party = state?.party;
  if (!party) return null;
  const cleared = party.members.filter((m) => m.today.status === 'cleared').length;
  const rewardReady = (state?.rewards.length || 0) > 0;

  return (
    <button
      type="button"
      onClick={() => {
        systemSound.playClick();
        navigate('/party');
      }}
      className="w-full mb-4 flex items-center justify-between gap-2 px-3 py-2 border border-white/25 bg-[#061424]/60 hover:border-cyan-400/60 rounded-[2px] font-mono text-[11px] text-white/80 transition-colors"
    >
      <span className="flex items-center gap-2 min-w-0">
        <Users className="w-3.5 h-3.5 text-[#9fd3ff] shrink-0" />
        <span className="truncate">
          PARTY · {cleared}/{party.members.length} CLEARED · BOND {party.bond.streak}
        </span>
      </span>
      <span className="flex items-center gap-1 shrink-0">
        {rewardReady && <span className="text-amber-300 font-bold">REWARD</span>}
        <ChevronRight className="w-3.5 h-3.5 text-white/40" />
      </span>
    </button>
  );
}
