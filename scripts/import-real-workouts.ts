import { resolveWorkspacePaths } from "../server/workspace.js";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse, stringify } from "yaml";
import {
  calculateStimulus,
  muscleMapSchema,
  stimulusRulesSchema,
  workoutSchema
} from "../shared/fitness/index.js";

const paths = resolveWorkspacePaths();
const dataRoot = paths.fitnessRoot;
type RawSet = {
  weight_kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  bodyweight_factor?: number | null;
  duration_sec?: number | null;
};
type RawWorkout = {
  date: string;
  title: string;
  bodyweight_kg?: number;
  duration_min?: number;
  user_note?: string | null;
  goals?: string[];
  readiness?: Record<string, number | null>;
  blocks?: Array<{
    type: string;
    name: string;
    exercises?: Array<{ name: string; sets?: RawSet[] }>;
  }>;
};
const exerciseIds: Record<string, string> = {
  波速上踏步抬膝: "step_up",
  杠铃弯举: "biceps_curl",
  杠铃直立划船: "upright_row",
  垂直举腿: "leg_raise",
  悬挂直膝到屈膝: "leg_raise",
  辅助引体向上: "assisted_pull_up",
  杠铃地雷架单手硬拉: "deadlift",
  杠铃卧推: "horizontal_press",
  杠铃硬拉静力: "deadlift",
  杠铃泽奇深蹲: "squat",
  高团支撑: "plank",
  高位下拉: "lat_pulldown",
  肱三头肌下压: "triceps_pressdown",
  跪姿俯卧撑: "horizontal_press",
  哈克机上斜宽距深蹲: "wide_squat",
  哈克机上斜窄距深蹲: "squat",
  壶铃美式硬拉: "deadlift",
  蝴蝶机后拉: "rear_delt_pull",
  离心俯卧撑: "horizontal_press",
  离心引体: "pull_up",
  屈髋: "deadlift",
  绳索面拉: "rear_delt_pull",
  史密斯机反手水平划船: "horizontal_row",
  史密斯机辅助引体: "assisted_pull_up",
  史密斯机上斜卧推: "incline_press",
  史密斯机深蹲: "squat",
  史密斯机卧推: "horizontal_press",
  史密斯机坐姿推举: "overhead_press",
  双杠辅助臂屈伸: "dip",
  双杠划船: "horizontal_row",
  "跳箱上下箱（登阶）": "step_up",
  跳箱踏步: "step_up",
  稳定球单腿侧支撑: "side_plank",
  稳定球双腿弯举: "leg_curl",
  箱式俯卧撑: "horizontal_press",
  哑铃侧平举: "lateral_raise",
  哑铃交替垂式弯举: "hammer_curl",
  哑铃上斜卧推: "incline_press",
  药球深蹲推起: "squat_press",
  侧卧抬腿: "hip_abduction",
  直腿对侧仰卧起坐: "cross_body_crunch",
  自重单腿硬拉: "single_leg_deadlift",
  自重深蹲: "squat",
  "坐姿划船（对握）": "horizontal_row",
  坐姿划船: "horizontal_row",
  坐姿蹬腿: "leg_press",
  坐姿哑铃肩推: "overhead_press",
  坐姿推肩: "overhead_press",
  坐姿推胸: "horizontal_press",
  坐姿腿伸展: "leg_extension",
  T杠单臂实力推: "overhead_press"
};

const bodyweightFactors: Record<string, number> = {
  horizontal_press: 0.55,
  pull_up: 0.9,
  assisted_pull_up: 0.55,
  dip: 0.55,
  horizontal_row: 0.5,
  squat: 0.8,
  step_up: 0.75,
  leg_raise: 0.25,
  plank: 0.25,
  side_plank: 0.25,
  single_leg_deadlift: 0.7,
  hip_abduction: 0.15,
  leg_curl: 0.5,
  cross_body_crunch: 0.25
};

const [muscleMap, rules] = await Promise.all([
  readFile(join(paths.resourcesRoot, "muscles", "muscle_map.yaml"), "utf8").then((text) =>
    muscleMapSchema.parse(parse(text))
  ),
  readFile(join(paths.resourcesRoot, "muscles", "stimulus_rules.yaml"), "utf8").then((text) =>
    stimulusRulesSchema.parse(parse(text))
  )
]);
const files = (await readdir(dataRoot))
  .filter((file) => /^2026-\d{2}-\d{2}-\d+\.yaml$/.test(file))
  .sort();

if (files.length === 0) throw new Error("No raw workout files found in data/");

const archiveRoot = join(dataRoot, "imports", "raw");
await mkdir(archiveRoot, { recursive: true });
let imported = 0;

for (const file of files) {
  const raw = parse(await readFile(join(dataRoot, file), "utf8")) as RawWorkout;
  const date = String(raw.date);
  const readiness = Object.fromEntries(
    Object.entries(raw.readiness ?? {}).filter(([, value]) => typeof value === "number")
  );
  const blocks = (raw.blocks ?? []).map((block) => ({
    type: String(block.type),
    name: String(block.name).trim(),
    exercises: (block.exercises ?? []).map((exercise) => {
      const name = String(exercise.name).trim();
      const exerciseId = block.type === "strength" ? exerciseIds[name] : undefined;
      if (block.type === "strength" && !exerciseId) {
        throw new Error(`${file}: missing exercise mapping for ${name}`);
      }
      if (exerciseId && !muscleMap[exerciseId]) {
        throw new Error(`${file}: muscle map missing ${exerciseId}`);
      }

      return {
        name,
        exercise_id: exerciseId,
        sets: (exercise.sets ?? []).map((rawSet) => {
          const set = Object.fromEntries(
            Object.entries(rawSet).filter(([, value]) => value != null)
          ) as Record<string, number>;
          if (block.type === "strength" && set.reps == null && set.duration_sec != null) {
            set.reps = 1;
          }
          if (block.type === "strength" && set.weight_kg == null && exerciseId) {
            const factor = bodyweightFactors[exerciseId];
            if (factor != null) set.bodyweight_factor = factor;
            else set.weight_kg = 0;
          }
          if (exerciseId === "assisted_pull_up" && rawSet.weight_kg != null) {
            set.weight_kg = Math.max((raw.bodyweight_kg ?? 70) - rawSet.weight_kg, 0);
          }
          return set;
        })
      };
    })
  }));

  const draft = workoutSchema.parse({
    schema_version: 1,
    id: `workout_${date}`,
    date,
    title: raw.title,
    bodyweight_kg: raw.bodyweight_kg,
    duration_min: raw.duration_min,
    user_note:
      typeof raw.user_note === "string" && raw.user_note.trim() ? raw.user_note.trim() : undefined,
    goals: raw.goals,
    source_import_file: `imports/raw/${basename(file)}`,
    readiness,
    blocks
  });
  const workout = workoutSchema.parse({
    ...draft,
    computed: calculateStimulus(draft, muscleMap, rules)
  });
  const target = join(dataRoot, "workouts", date.slice(0, 4), `${date}.yaml`);
  await mkdir(join(dataRoot, "workouts", date.slice(0, 4)), { recursive: true });
  await writeFile(target, stringify(workout), { encoding: "utf8", flag: "wx" });
  await rename(join(dataRoot, file), join(archiveRoot, file));
  imported += 1;
}

console.log(`Imported ${imported} workouts into data/workouts and archived their raw sources.`);
