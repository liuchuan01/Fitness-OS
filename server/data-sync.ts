import { createHash } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import type { ServerResponse } from "node:http";
import type { DataSyncEvent } from "../shared/data-sync.js";
import { buildDashboardFromFiles, validateFitnessData } from "./data-store.js";

/** Publishes validated file revisions; no Session or message state is stored here. */
export class DataSync {
  private clients = new Set<ServerResponse>();
  private watchers = new Map<string, FSWatcher>();
  private timer?: ReturnType<typeof setTimeout>;
  private checking = false;
  private pending = false;
  private revision = "";
  private latest?: DataSyncEvent;
  private generation = 0;

  constructor(private readonly dataRoot: string) {}

  subscribe(response: ServerResponse) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    response.write("retry: 2000\n\n");
    this.clients.add(response);
    const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15000);
    heartbeat.unref();
    response.on("close", () => {
      clearInterval(heartbeat);
      this.clients.delete(response);
      if (this.clients.size === 0) this.stopWatching();
    });
    this.revision = "";
    this.schedule();
  }

  private async watchDirectories(root: string) {
    if (!this.clients.size) return;
    if (!this.watchers.has(root)) {
      const watcher = watch(root, (event, filename) => {
        if (filename && String(filename).startsWith(".")) return;
        if (event === "rename" && filename) {
          const target = join(root, String(filename));
          for (const [path, existing] of this.watchers) {
            if (path === target || path.startsWith(target + sep)) {
              existing.close();
              this.watchers.delete(path);
            }
          }
        }
        this.schedule();
      });
      watcher.on("error", () => this.close());
      this.watchers.set(root, watcher);
    }
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.name.startsWith(".") && entry.isDirectory())
        await this.watchDirectories(join(root, entry.name));
    }
  }

  close() {
    this.stopWatching();
    for (const client of this.clients) client.end();
    this.clients.clear();
  }

  private stopWatching() {
    this.generation += 1;
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    clearTimeout(this.timer);
    this.latest = undefined;
    this.revision = "";
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.check(), 350);
  }

  private async check() {
    if (this.checking) {
      this.pending = true;
      return;
    }
    if (this.clients.size === 0) return;
    this.checking = true;
    const generation = this.generation;
    try {
      await this.watchDirectories(this.dataRoot);
      const revision = await fingerprint(this.dataRoot);
      if (revision === this.revision && this.latest?.type === "fitness.data-changed") return;
      await validateFitnessData({ dataRoot: this.dataRoot });
      await buildDashboardFromFiles({ dataRoot: this.dataRoot, readOnly: true });
      if (revision !== (await fingerprint(this.dataRoot))) {
        this.pending = true;
        return;
      }
      if (generation !== this.generation) return;
      this.revision = revision;
      this.publish({
        v: 1,
        type: "fitness.data-changed",
        revision,
        changed: ["dashboard", "today-plan", "workouts"],
        at: new Date().toISOString()
      });
    } catch {
      if (generation !== this.generation) return;
      this.publish({ v: 1, type: "fitness.data-invalid", at: new Date().toISOString() });
    } finally {
      this.checking = false;
      if (this.pending) {
        this.pending = false;
        this.schedule();
      }
    }
  }

  private publish(event: DataSyncEvent) {
    this.latest = event;
    for (const client of this.clients) this.send(client, event);
  }

  private send(client: ServerResponse, event: DataSyncEvent) {
    if (!client.write(`data: ${JSON.stringify(event)}\n\n`)) client.end();
  }
}

async function fingerprint(root: string): Promise<string> {
  const hash = createHash("sha256");
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) hash.update(entry.name + ":" + (await fingerprint(path)));
    else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      hash.update(entry.name + ":").update(await readFile(path));
    }
  }
  return hash.digest("hex");
}
