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
