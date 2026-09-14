import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("DSH per-request profile context", () => {
  it("reads changes for every request and does not fall back to examples", async () => {
    const modulePath = "../../dsh-fitness/automation-bridge/index.js";
    const { readProfileContext } = await import(modulePath);
    const root = await mkdtemp(join(tmpdir(), "fitness-context-"));
    try {
      const file = join(root, "profile.yaml");
      expect(readProfileContext(file)).toContain("没有正式档案");
      await writeFile(file, "preferences: {equipment: bands}\n");
      const first = readProfileContext(file);
      await writeFile(file, "preferences: {equipment: dumbbells}\n");
      const next = readProfileContext(file);
      expect(first).toContain("bands");
      expect(next).toContain("dumbbells");
      expect(next).not.toEqual(first);
      expect(next).toMatch(/profile_revision: [a-f0-9]{64}/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
