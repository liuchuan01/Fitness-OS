import process from "node:process";
import { LlmAdapter } from "@deepseek-ai/dsh-llm";

export const inject = ["llm"];
export function apply(ctx) {
  class FixtureAdapter extends LlmAdapter {
    readSessions = new Set();
    async listModels(provider) {
      return [{ provider, id: "fixture", name: "Fitness fixture" }];
    }
    async resolveModel(provider, model) {
      return { provider, id: model, name: "Fitness fixture", context: { contextWindow: 131072 } };
    }
    async *stream(options) {
      const system = JSON.stringify(
        options.messages.filter((message) => message.role === "system")
      );
      if (!system.includes("fitness_profile") || !system.includes("profile_revision")) {
        throw new Error("Fitness profile context did not reach the model request");
      }
      if (!this.readSessions.has(options.sessionId)) {
        this.readSessions.add(options.sessionId);
        if (!options.tools.some((tool) => tool.name === "read"))
          throw new Error("read tool unavailable");
        const args = JSON.stringify({ file_path: "AGENTS.md" });
        yield { type: "block-start", index: 0, blockType: "tool-call" };
        yield {
          type: "tool-call-delta",
          index: 0,
          id: "fixture-read",
          name: "read",
          argumentsDelta: args
        };
        yield {
          type: "block-end",
          index: 0,
          block: { type: "tool-call", id: "fixture-read", name: "read", arguments: args }
        };
        yield { type: "finish", reason: { kind: "tool-calls" } };
        return;
      }
      const text = `升级验证完成。档案：${system.includes("bands") ? "bands" : "dumbbells"}。查看 [工作区说明](${process.cwd()}/AGENTS.md)。`;
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "text-delta", index: 0, text };
      yield { type: "block-end", index: 0, block: { type: "text", text } };
      yield { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } };
      yield { type: "finish", reason: { kind: "stop" } };
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(["fitness-test"], new FixtureAdapter()));
}
