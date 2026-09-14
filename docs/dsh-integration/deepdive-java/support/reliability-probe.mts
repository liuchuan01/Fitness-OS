// Isolated, keyless probe. No production workspace is read or changed.
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AutomationScheduler } from '../../../../server/automation.ts';
import { defaultApplicationSettings } from '../../../../server/agent-settings.ts';

const root = await mkdtemp(join(tmpdir(), 'dsh-report-probe-'));
try {
  const fitness = join(root, 'fitness');
  await mkdir(fitness, { recursive: true });
  // Deliberately invalid fixture: every scheduled attempt fails preflight.
  await writeFile(join(fitness, 'profile.yaml'), 'schema_version: 999\n');
  const settings = defaultApplicationSettings();
  settings.automation.daily_plan.enabled = true;
  const settingsPath = join(root, 'settings.yaml');
  await writeFile(settingsPath, JSON.stringify(settings)); // JSON is valid YAML.
  let now = new Date('2026-06-20T01:05:00Z');
  const scheduler = new AutomationScheduler(root, fitness, settingsPath,
    join(root, 'state.yaml'), join(root, 'runs'),
    { async run() { throw new Error('must not reach model'); }, async close() {} }, () => now);
  const results = [];
  for (const instant of ['01:05:00', '01:06:01', '01:11:02', '01:12:03']) {
    now = new Date(`2026-06-20T${instant}Z`);
    await scheduler.tick();
    const state = (await scheduler.getState()).daily_plan;
    results.push({ instant, status: state.last_run?.status,
      retryAttempt: state.retry?.attempt_count ?? null,
      retryAt: state.retry?.next_retry_at ?? null,
      completedCursor: state.scheduled_cursor ?? null });
  }
  console.log(JSON.stringify({ results, runFiles: (await readdir(join(root, 'runs'))).length }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
