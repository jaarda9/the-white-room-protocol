import { useEffect } from 'react';

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

    const scrollY = window.scrollY;
    const body = document.body;
    const original = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.left = original.left;
      body.style.right = original.right;
      body.style.width = original.width;
      body.style.overflow = original.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
