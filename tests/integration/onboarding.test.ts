import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import {
  assertProfileRevision,
  updateOnboardingProfile,
  commitOnboardingMetric,
  commitOnboardingProfile,
  commitOnboardingProgram,
  getOnboardingState,
  saveOnboardingDraft,
  validateOnboardingData
} from "../../server/onboarding.js";

const roots: string[] = [];
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "fitness-onboarding-"));
  roots.push(root);
  return { fitnessRoot: join(root, "fitness"), runtimeRoot: join(root, "runtime") };
}
const profile = {
  schema_version: 1,
  goals: { primary: "建立规律训练" },
  unknowns: ["当前体重", "伤病情况"],
  confirmation: { confirmed_at: "2026-09-13T00:00:00.000Z", source: "user_confirmed" }
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
describe("confirmed onboarding facts", () => {
  it("starts empty, retains drafts separately and reconstructs progress after runtime deletion", async () => {
    const paths = await workspace();
    expect(await getOnboardingState(paths)).toMatchObject({
      stage: "empty",
      profileConfirmed: false,
      hasWorkout: false
    });
    await saveOnboardingDraft(paths, { schema_version: 1, unknowns: ["目标"] });
    expect(await getOnboardingState(paths)).toMatchObject({ stage: "draft" });
    const result = await commitOnboardingProfile(paths, profile);
    await rm(paths.runtimeRoot, { recursive: true, force: true });
    expect(await getOnboardingState(paths)).toMatchObject({
      stage: "profile_confirmed",
      profileRevision: result.revision,
      hasWorkout: false
    });
    expect(await readFile(join(paths.fitnessRoot, "profile.yaml"), "utf8")).not.toContain(
      "bodyweight"
    );
  });
  it("is idempotent under concurrent submissions and refuses conflicting facts", async () => {
    const paths = await workspace();
    const results = await Promise.all([
      commitOnboardingProfile(paths, profile),
      commitOnboardingProfile(paths, profile)
    ]);
    expect(results[0].revision).toBe(results[1].revision);
    await expect(
      commitOnboardingProfile(paths, { ...profile, goals: { primary: "新目标" } })
    ).rejects.toThrow("CONFLICT");
    await expect(
      commitOnboardingProfile(paths, { ...profile, user: { age_years: 30 } })
    ).rejects.toThrow("observation date");
  });
  it("commits a program separately and rejects stale profile context", async () => {
    const paths = await workspace();
    const { revision } = await commitOnboardingProfile(paths, profile);
    const program = {
      schema_version: 1,
      id: "first",
      name: "观察安排",
      start_date: "2026-09-13",
      end_date: "2026-09-27",
      outcome: { goal: "形成训练习惯" },
      weekly_schedule: [
        { day_of_week: "monday", slot_id: "first", type: "strength", direction: "全身练习" }
      ],
      confirmation: profile.confirmation,
      profile_revision: revision
    };
    const lock = join(paths.runtimeRoot, "onboarding", "profile-update.lock");
    await mkdir(join(paths.runtimeRoot, "onboarding"), { recursive: true });
    await writeFile(lock, String(process.pid));
    await expect(commitOnboardingProgram(paths, program)).rejects.toThrow("UPDATE_IN_PROGRESS");
    await rm(lock);
    await commitOnboardingProgram(paths, program);
    expect(await getOnboardingState(paths, "2026-09-14")).toMatchObject({
      stage: "program_confirmed",
      activeProgramId: "first"
    });
    await writeFile(
      join(paths.fitnessRoot, "profile.yaml"),
      stringify({ ...profile, unknowns: [] })
    );
    await expect(assertProfileRevision(paths, revision)).rejects.toThrow("REVISION_CONFLICT");
    expect(await getOnboardingState(paths, "2026-10-14")).toMatchObject({ activeProgramId: null });
  });
  it("updates confirmed preferences with revision checks and preserves metric conflicts", async () => {
    const paths = await workspace();
    const { revision } = await commitOnboardingProfile(paths, profile);
    const updated = await updateOnboardingProfile(
      paths,
      { ...profile, preferences: { loading: "保留余力" } },
      revision!
    );
    expect(updated.revision).not.toBe(revision);
    await expect(updateOnboardingProfile(paths, profile, revision!)).rejects.toThrow(
      "REVISION_CONFLICT"
    );
    const body = { schema_version: 1, measurements: [{ date: "2026-09-13", bodyweight_kg: 70 }] };
    await commitOnboardingMetric(paths, "body", body);
    await commitOnboardingMetric(paths, "body", body);
    await expect(
      commitOnboardingMetric(paths, "body", {
        ...body,
        measurements: [{ date: "2026-09-13", bodyweight_kg: 71 }]
      })
    ).rejects.toThrow("CONFLICT");
    await commitOnboardingMetric(paths, "body", {
      schema_version: 1,
      measurements: [{ date: "2026-09-14", bodyweight_kg: 69 }]
    });
    expect(await readFile(join(paths.fitnessRoot, "metrics/body.yaml"), "utf8")).toContain(
      "2026-09-14"
    );
    expect(await validateOnboardingData(paths)).toMatchObject({ profiles: 1, metrics: 1 });
  });
  it("refuses symbolic links in profile and program write boundaries", async () => {
    const paths = await workspace();
    const { revision } = await commitOnboardingProfile(paths, profile);
    const external = join(paths.runtimeRoot, "external.yaml");
    await mkdir(paths.runtimeRoot, { recursive: true });
    await writeFile(external, stringify(profile));
    await rm(join(paths.fitnessRoot, "profile.yaml"));
    await symlink(external, join(paths.fitnessRoot, "profile.yaml"));
    await expect(getOnboardingState(paths)).rejects.toThrow("SYMLINK");
    await expect(updateOnboardingProfile(paths, profile, revision!)).rejects.toThrow("SYMLINK");
    await rm(join(paths.fitnessRoot, "profile.yaml"));
    const saved = await commitOnboardingProfile(paths, profile);
    await symlink(paths.runtimeRoot, join(paths.fitnessRoot, "programs"));
    await expect(
      commitOnboardingProgram(paths, {
        schema_version: 1,
        id: "first",
        name: "观察安排",
        start_date: "2026-09-13",
        end_date: "2026-09-27",
        outcome: { goal: "形成训练习惯" },
        weekly_schedule: [
          { day_of_week: "monday", slot_id: "first", type: "strength", direction: "全身练习" }
        ],
        confirmation: profile.confirmation,
        profile_revision: saved.revision
      })
    ).rejects.toThrow("SYMLINK");
    expect(await readFile(external, "utf8")).toBe(stringify(profile));
  });
  it("validates programs and measured values instead of accepting arbitrary YAML", async () => {
    const paths = await workspace();
    await mkdir(join(paths.fitnessRoot, "programs"), { recursive: true });
    await writeFile(join(paths.fitnessRoot, "programs", "broken.yaml"), "schema_version: 1\n");
    await expect(validateOnboardingData(paths)).rejects.toThrow("broken.yaml");
    await rm(join(paths.fitnessRoot, "programs"), { recursive: true });
    await mkdir(join(paths.fitnessRoot, "metrics"));
    await writeFile(
      join(paths.fitnessRoot, "metrics", "body.yaml"),
      stringify({ schema_version: 1, measurements: [{ date: "2026-02-30", bodyweight_kg: 70 }] })
    );
    await expect(validateOnboardingData(paths)).rejects.toThrow("Invalid calendar date");
  });
});
