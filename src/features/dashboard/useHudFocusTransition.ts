import { useLayoutEffect, useRef } from "react";

const positions = ["recovery", "load", "volume", "stimulus"] as const;

/** Preserve the four spatial identities even when overview/focus content mounts anew. */
export function useHudFocusTransition(focused: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const syncLayout = () => {
      container.dataset.focusRail = String(
        focused && container.clientWidth >= 700 && window.innerWidth > 1100
      );
    };
    syncLayout();
    const cards = positions.flatMap((position) => {
      const element = container.querySelector<HTMLElement>(`.hud-${position}`);
      return element ? [{ position, element }] : [];
    });
    const before = previous.current;
    const animations: Animation[] = [];
    const canAnimate =
      container.clientWidth >= 700 &&
      window.innerWidth > 1100 &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const { position, element } of cards) {
      const old = before.get(position);
      const next = element.getBoundingClientRect();
      if (canAnimate && old && (Math.abs(old.x - next.x) > 1 || Math.abs(old.y - next.y) > 1)) {
        animations.push(
          element.animate(
            [
              { transform: `translate(${old.x - next.x}px, ${old.y - next.y}px)` },
              { transform: "translate(0, 0)" }
            ],
            { duration: focused ? 720 : 650, easing: "cubic-bezier(.22,.68,0,1)" }
          )
        );
      }
    }
    animations.forEach((animation) => {
      animation.pause();
      animation.currentTime = 0;
    });
    let frame = 0;
    let elapsed = 0;
    let lastFrame: number | null = null;
    const duration = focused ? 720 : 650;
    const remember = () => {
      previous.current = new Map(
        cards.map(({ position, element }) => [position, element.getBoundingClientRect()])
      );
    };
    const track = (now: number) => {
      elapsed += lastFrame === null ? 0 : Math.min(now - lastFrame, 120);
      lastFrame = now;
      if (
        container.clientWidth < 700 ||
        window.innerWidth <= 1100 ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        elapsed = duration;
      animations.forEach((animation) => {
        animation.currentTime = Math.min(elapsed, duration);
      });
      remember();
      if (animations.length && elapsed < duration) frame = requestAnimationFrame(track);
      else animations.forEach((animation) => animation.cancel());
    };
    remember();
    frame = requestAnimationFrame(track);
    const observer = new ResizeObserver(() => {
      syncLayout();
      remember();
    });
    observer.observe(container);
    cards.forEach(({ element }) => observer.observe(element));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [focused]);
  return root;
}
