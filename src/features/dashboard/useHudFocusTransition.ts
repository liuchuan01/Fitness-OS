import { subscribeFocusFrames } from "../../design/focus-transition";
import { useLayoutEffect, useRef } from "react";

const positions = ["recovery", "load", "volume", "stimulus"] as const;

/** Preserve the four spatial identities across mode changes, driven by rendered camera frames. */
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
    const measure = () =>
      new Map(cards.map(({ position, element }) => [position, element.getBoundingClientRect()]));
    let animations: Animation[] = [];
    let activeId: number | null = null;
    const cancel = () => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
    };
    const prepare = (before: Map<string, DOMRect>) => {
      cancel();
      if (
        container.clientWidth < 700 ||
        window.innerWidth <= 1100 ||
        !container.closest(".body-stage")?.querySelector("canvas")
      )
        return;
      for (const { position, element } of cards) {
        const old = before.get(position);
        const next = element.getBoundingClientRect();
        if (!old || (Math.abs(old.x - next.x) < 1 && Math.abs(old.y - next.y) < 1)) continue;
        const animation = element.animate(
          [
            { transform: `translate(${old.x - next.x}px, ${old.y - next.y}px)` },
            { transform: "translate(0, 0)" }
          ],
          { duration: 1, easing: "linear", fill: "both" }
        );
        animation.pause();
        animation.currentTime = 0;
        animations.push(animation);
      }
    };
    prepare(previous.current);
    previous.current = measure();
    const unsubscribe = subscribeFocusFrames(container, (frame) => {
      if (frame.focusing !== focused) return;
      // Retarget from the visible position if another muscle interrupts the camera transition.
      if (activeId !== null && activeId !== frame.id) prepare(measure());
      activeId = frame.id;
      animations.forEach((animation) => {
        animation.currentTime = frame.progress;
      });
      if (frame.progress >= 1) cancel();
      previous.current = measure();
    });
    const observer = new ResizeObserver(() => {
      syncLayout();
      if (container.clientWidth < 700 || window.innerWidth <= 1100) cancel();
      previous.current = measure();
    });
    observer.observe(container);
    cards.forEach(({ element }) => observer.observe(element));
    return () => {
      unsubscribe();
      observer.disconnect();
      cancel();
    };
  }, [focused]);
  return root;
}
