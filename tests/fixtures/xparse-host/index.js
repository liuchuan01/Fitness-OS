/* global AbortController */
export const inject = ["webServer", "skills", "tools"];
export function apply(ctx) {
  ctx.webServer.register({
    kind: "exact",
    path: "/fitness-test-xparse",
    handler: async (request, response) => {
      response.setHeader("Content-Type", "application/json");
      if (request.method === "POST") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk.toString());
        const result = await ctx.tools.execute({
          name: "xparse",
          arguments: JSON.parse(chunks.join("")),
          callId: "test-call",
          signal: new AbortController().signal
        });
        response.end(JSON.stringify(result));
      } else {
        const skills = await ctx.skills.list();
        const skill = await ctx.skills.get("xparse-parse");
        response.end(
          JSON.stringify({
            available: skills.some((item) => item.name === "xparse-parse"),
            content: skill?.content ?? null,
            tool: Boolean(ctx.tools.get("xparse"))
          })
        );
      }
    }
  });
}
