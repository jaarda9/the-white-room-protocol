import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Download, IdCard, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserProfile } from '@/lib/types';
import { getHunterRank, getHunterTitle } from '@/lib/storage';
import {
  checkLicenseReissue,
  fetchOwnHandle,
  getCachedHandle,
  getLicensePhoto,
  licenseNumber,
  normalizedStats,
  processLicensePhoto,
  setLicensePhoto,
  type LicenseRank,
} from '@/lib/hunter-license';
import { FlippableHunterId, RANK_COLORS, svgToPngBlob, type HunterIdData } from '@/components/license/HunterIdCard';
import { systemSound } from '@/lib/system-sound';
import { syncManager } from '@/lib/sync-manager';

/** The player's own Hunter License data (also used by the Leaderboard for the "YOU" row). */
export function ownLicenseData(profile: UserProfile, handle: string, photo: string): HunterIdData {
  return {
    name: profile.displayName || profile.fullName || 'Hunter',
    rank: getHunterRank(profile.level) as LicenseRank,
    licenseNo: licenseNumber(handle),
    handle: handle || undefined,
    level: profile.level,
    title: getHunterTitle(profile.level, profile.title),
    stats: normalizedStats(profile.visibleStats as any),
    issued: profile.createdAt,
    photo: photo || undefined,
  };
}

export default function HunterLicenseSection({ profile }: { profile: UserProfile }) {
  const [handle, setHandle] = useState(() => getCachedHandle(profile.id));
  const [photo, setPhoto] = useState(() => getLicensePhoto());
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [reissuedFrom, setReissuedFrom] = useState<LicenseRank | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<SVGSVGElement>(null);

  const rank = getHunterRank(profile.level) as LicenseRank;

  useEffect(() => {
    let alive = true;
    if (!handle) {
      fetchOwnHandle(profile.id).then((h) => {
        if (alive && h) setHandle(h);
      });
    }
    return () => {
      alive = false;
    };
  }, [profile.id, handle]);

  // Only after the save has loaded: before that, the stored rank may be another device's
  // (newer) or about to be replaced by the server copy, which would replay or lose the ceremony.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await syncManager.ensureInitialLoad();
      } catch {
        // offline: compare against what this device has
      }
      if (!alive) return;
      setPhoto(getLicensePhoto());
      const prev = checkLicenseReissue(rank);
      if (prev) {
        setReissuedFrom(prev);
        systemSound.playClick();
      }
    })();
    return () => {
      alive = false;
    };
  }, [rank]);

  // A pull from another device can bring a photo in while this page is open.
  useEffect(() => {
    const onStorage = () => setPhoto(getLicensePhoto());
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onStorage);
    };
  }, []);

  const data = useMemo(() => ownLicenseData(profile, handle, photo), [profile, handle, photo]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('photo');
    try {
      const url = await processLicensePhoto(file);
      if (!setLicensePhoto(url)) throw new Error('Device storage is full.');
      setPhoto(url);
      toast.success('[SYSTEM] License photo registered.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'This image could not be used.');
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = () => {
    systemSound.playClick();
    setLicensePhoto(null);
    setPhoto('');
  };

  const saveCard = async () => {
    if (!frontRef.current) return;
    systemSound.playClick();
    setBusy('save');
    try {
      const blob = await svgToPngBlob(frontRef.current);
      const file = new File([blob], 'hunter-license.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: 'Hunter License' });
        } catch (err) {
          if ((err as Error)?.name !== 'AbortError') throw err;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hunter-license.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch {
      toast.error('This device could not create the image. Take a screenshot of the card instead.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[10px] text-[#9fd3ff] tracking-wider uppercase font-bold flex items-center gap-1.5">
          <IdCard className="w-3.5 h-3.5 text-cyan-400" />
          <span>HUNTER LICENSE</span>
        </div>
        <span className="text-[10px] text-white/40">tap the card to flip</span>
      </div>

      {reissuedFrom && (
        <button
          type="button"
          onClick={() => setReissuedFrom(null)}
          className="w-full mb-3 px-3 py-2 border border-amber-300/60 bg-amber-950/30 text-left text-[11px] text-amber-100 rounded-[2px] animate-pulse"
        >
          <span className="font-bold text-amber-300">[LICENSE RE-ISSUED]</span> Rank {reissuedFrom} →{' '}
          <span className="font-bold" style={{ color: RANK_COLORS[rank] }}>
            Rank {rank}
          </span>
          . The Association has updated your classification.
        </button>
      )}

      <FlippableHunterId data={data} frontRef={frontRef} />

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px]">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            systemSound.playClick();
            fileRef.current?.click();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 text-cyan-300 hover:text-white rounded-[2px] disabled:opacity-50"
        >
          {busy === 'photo' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          {photo ? '[ CHANGE PHOTO ]' : '[ ADD PHOTO ]'}
        </button>
        {photo && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={removePhoto}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/25 hover:border-white/50 text-white/60 hover:text-white rounded-[2px] disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            [ REMOVE ]
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={saveCard}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 text-cyan-300 hover:text-white rounded-[2px] disabled:opacity-50"
        >
          {busy === 'save' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          [ SAVE CARD ]
        </button>
      </div>
      <p className="mt-2 text-[10px] text-white/40 text-center leading-relaxed">
        Your photo stays on your account and is never shown to other Hunters. Classes fill in as your attributes grow.
      </p>
    </div>
  );
}
