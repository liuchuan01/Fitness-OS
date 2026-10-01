/** Deliberate layout changes retain continuity even when ambient motion is reduced. */
export function focusTransitionTiming(focusing: boolean, reducedMotion: boolean) {
  return {
    duration: reducedMotion ? 400 : focusing ? 720 : 650,
    zoomDelay: focusing && !reducedMotion ? 90 : 0
  };
}

export type FocusTransitionFrame = { id: number; focusing: boolean; progress: number };
const frameEvent = "body-focus-frame";

// A stage-local clock lets DOM HUDs consume the same rendered frame as the WebGL camera.
export function publishFocusFrame(canvas: HTMLCanvasElement, frame: FocusTransitionFrame) {
  canvas.closest(".body-stage")?.dispatchEvent(new CustomEvent(frameEvent, { detail: frame }));
}
export function subscribeFocusFrames(
  element: HTMLElement,
  receive: (frame: FocusTransitionFrame) => void
) {
  const stage = element.closest(".body-stage");
  const listener = (event: Event) => receive((event as CustomEvent<FocusTransitionFrame>).detail);
  stage?.addEventListener(frameEvent, listener);
  return () => stage?.removeEventListener(frameEvent, listener);
}

/** Use usable canvas space so opening a panel does not abruptly remove desktop focus. */
export function focusComposition(width: number, height: number, viewportWidth: number) {
  const enabled = viewportWidth >= 900 && width >= 560 && height >= 360;
  const compact = width < 700 || viewportWidth <= 1100 || height < 600;
  return { enabled, compact, zoom: compact ? 1.12 : 1.22, shift: compact ? 0.12 : 0.16 };
}
