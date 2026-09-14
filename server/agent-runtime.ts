import { randomUUID } from "node:crypto";

export type AgentRunResult = {
  sessionId: string;
  finalResponse: string;
  notifications: unknown[];
};

export interface AgentRuntime {
  run(sessionId: string, message: string): Promise<AgentRunResult>;
  close(): Promise<void>;
}

export const disabledAgentRuntime: AgentRuntime = {
  async run() {
    throw new Error("Agent runtime is not configured");
  },
  async close() {}
};

export class DshHostAgentRuntime implements AgentRuntime {
  constructor(
    private readonly options: {
      bridgeUrl: string;
      secret: string;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async run(sessionId: string, message: string): Promise<AgentRunResult> {
    const runId = randomUUID();
    const requestId = `fitness-${runId}`;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(this.options.bridgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-fitness-bridge-secret": this.options.secret
      },
      body: JSON.stringify({ sessionId, runId, requestId, message })
    });
    if (!response.ok)
      throw new Error(`DSH Host bridge rejected automation admission (${response.status})`);

    const statusUrl = new URL(`${this.options.bridgeUrl}/status`);
    statusUrl.searchParams.set("sessionId", sessionId);
    statusUrl.searchParams.set("runId", runId);
    const deadline = Date.now() + 10 * 60_000;
    for (;;) {
      if (Date.now() > deadline)
        throw new Error("Timed out waiting for DSH Host automation completion");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const status = await fetchImpl(statusUrl, {
        headers: { "x-fitness-bridge-secret": this.options.secret }
      });
      if (!status.ok) continue;
      const body = (await status.json()) as { state?: string };
      if (body.state === "idle") {
        return { sessionId, finalResponse: "", notifications: [] };
      }
    }
  }

  async close(): Promise<void> {}
}
