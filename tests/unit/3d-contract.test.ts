import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const contract = JSON.parse(
  readFileSync(resolve(root, "3d-muscles/body-model-contract.json"), "utf8")
);
const manifest = JSON.parse(
  readFileSync(resolve(root, "3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json"), "utf8")
);

describe("3D muscle contract", () => {
  it("covers all 67 taxonomy muscles without invented fallback", () => {
    expect(Object.keys(contract.muscles)).toHaveLength(67);
    expect(contract.schema_version).toBe(3);
    expect(contract.summary.coverage).toEqual({ exact: 60, partial: 7, missing: 0 });
    expect(contract).not.toHaveProperty("legacy_aggregates");
  });

  it("allows exact picking only", () => {
    for (const muscle of Object.values(contract.muscles) as Array<{
      coverage: string;
      pickable: boolean;
    }>) {
      expect(muscle.pickable).toBe(muscle.coverage === "exact");
    }
  });

  it("maps every manifest target to exactly one muscle", () => {
    const manifestTargets = Object.values(manifest.targets).flat() as string[];
    const contractTargets = Object.values(contract.muscles).flatMap(
      (muscle) => (muscle as { model_targets: string[] }).model_targets
    );
    expect(contractTargets).toHaveLength(133);
    expect(new Set(contractTargets).size).toBe(133);
    expect(new Set(contractTargets)).toEqual(new Set(manifestTargets));
  });

  it("maps the lower erector id only to real erector geometry", () => {
    expect(contract.muscles.erector_spinae_lower.coverage).toBe("partial");
    expect(contract.muscles.erector_spinae_lower.model_targets).toEqual([
      "muscle.erector_spinae_lower.right",
      "muscle.erector_spinae_lower.left"
    ]);
  });
});
