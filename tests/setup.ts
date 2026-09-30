import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom has no layout observer; real HUD geometry is verified in Playwright.
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
