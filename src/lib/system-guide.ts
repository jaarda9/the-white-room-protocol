/**
 * New-player guide state: the System's orientation tour (SystemGuide.tsx) and the one-time
 * "first contact" cards each main page shows the first time a new Hunter opens it
 * (FirstContactCard.tsx). Synced, so a Hunter who switches devices is not re-taught.
 *
 * Started automatically only for new registrations; anyone can replay it from Profile.
 */

export const GUIDE_STATE_KEY = 'wrp_guide_state';
export const GUIDE_UPDATED_EVENT = 'wrp:guide-updated';

export interface GuideState {
  /** The tour opens on the dashboard until finished or skipped. */
  tourPending: boolean;
  /** First-contact cards are shown on pages not yet in `seen`. */
  firstContact: boolean;
  seen: string[];
}

const EMPTY: GuideState = { tourPending: false, firstContact: false, seen: [] };

export function getGuideState(): GuideState {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUIDE_STATE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    return {
      tourPending: Boolean(parsed.tourPending),
      firstContact: Boolean(parsed.firstContact),
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((s: unknown) => typeof s === 'string') : [],
    };
  } catch {
    return EMPTY;
  }
}

function saveGuideState(state: GuideState): void {
  try {
    localStorage.setItem(GUIDE_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GUIDE_UPDATED_EVENT));
}

/** New registration, or "Replay the System guide" from Profile. */
export function startGuide(): void {
  saveGuideState({ tourPending: true, firstContact: true, seen: [] });
}

export function finishTour(): void {
  saveGuideState({ ...getGuideState(), tourPending: false });
}

/** Skipping the tour also silences the page cards: the Hunter asked not to be guided. */
export function skipGuide(): void {
  saveGuideState({ ...getGuideState(), tourPending: false, firstContact: false });
}

export function shouldShowFirstContact(id: string): boolean {
  const s = getGuideState();
  return s.firstContact && !s.tourPending && !s.seen.includes(id);
}

export function markFirstContactSeen(id: string): void {
  const s = getGuideState();
  if (s.seen.includes(id)) return;
  saveGuideState({ ...s, seen: [...s.seen, id] });
}
