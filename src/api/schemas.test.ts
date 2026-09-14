import { describe, expect, it } from "vitest";
import { setSchema } from "./schemas";

describe("API schemas", () => {
  it("accepts duration-only sets returned by real workout records", () => {
    expect(
      setSchema.parse({
        duration_sec: 30,
        rpe: 5
      })
    ).toEqual({
      duration_sec: 30,
      rpe: 5
    });
  });
});
