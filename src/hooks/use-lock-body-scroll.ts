import { useEffect, useSyncExternalStore } from 'react';

// Every full-screen custom modal in the app calls useLockBodyScroll(isOpen), so its lifecycle
// is exactly "a modal is covering the screen" — reusing it here (rather than adding a second
// hook call to all 9 modal components) lets SystemDock hide the bottom nav while any of them
// is open. This matters because the modals' backdrop is only ~80% opaque + blurred (a deliberate
// look, not a bug), so the nav pill's own background/border was still faintly visible bleeding
// through it — SystemDock just needs to not be there at all while a modal covers the screen.
let openModalCount = 0;
const modalCountListeners = new Set<() => void>();

const notifyModalCountListeners = () => {
  modalCountListeners.forEach((listener) => listener());
};

export function subscribeAnyModalOpen(listener: () => void): () => void {
  modalCountListeners.add(listener);
  return () => {
    modalCountListeners.delete(listener);
  };
}

export function getAnyModalOpenSnapshot(): boolean {
  return openModalCount > 0;
}

/** True while at least one full-screen modal (anything using useLockBodyScroll) is open. */
export function useAnyModalOpen(): boolean {
  return useSyncExternalStore(subscribeAnyModalOpen, getAnyModalOpenSnapshot, () => false);
}

/**
 * Locks the page behind a `fixed inset-0` overlay from scrolling while it's open.
 *
 * Without this, the background page can still move — a touch-drag "leaking" through to the
 * page behind the modal, or (very relevant here) the on-screen keyboard opening for a number
 * input inside the modal, which can shift the underlying document. Since the modal's backdrop
 * is `position: fixed` (viewport-relative) while the background page moved (document-relative),
 * the two visually desync — the real page peeks out undimmed wherever they no longer line up.
 *
 * Plain `overflow: hidden` on <body> does NOT reliably stop this on iOS Safari specifically —
 * it still allows touch-scroll/rubber-banding of the page underneath. The reliable, iOS-safe
 * fix is to pin the body in place with `position: fixed` at its current scroll offset for the
 * duration, then restore the exact scroll position on close.
 */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    openModalCount += 1;
    notifyModalCountListeners();

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const original = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      height: body.style.height,
      overflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    // Without an explicit height, a position:fixed body with no `bottom` falls back to
    // shrink-to-fit — on iOS standalone PWAs that can make the visible viewport recompute
    // mid-lock, which is what left a gap at a modal's top or bottom edge. Pinning both
    // <html> and <body> to a fixed 100% height/overflow (the standard scroll-lock idiom;
    // most libraries lock both, not just body) closes that gap.
    body.style.height = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    return () => {
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.left = original.left;
      body.style.right = original.right;
      body.style.width = original.width;
      body.style.height = original.height;
      body.style.overflow = original.overflow;
      html.style.overflow = original.htmlOverflow;
      window.scrollTo(0, scrollY);

      openModalCount = Math.max(0, openModalCount - 1);
      notifyModalCountListeners();
    };
  }, [locked]);
}
