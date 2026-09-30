const namespace = "agent-default-model";

function parseSelection(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !["provider", "model", "reasoningEffort", "revision"].includes(key)
    ) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    [input.provider, input.model].some(
      (value) => typeof value !== "string" || !value.trim() || value.length > 200
    ) ||
    (input.reasoningEffort !== undefined &&
      (typeof input.reasoningEffort !== "string" ||
        !input.reasoningEffort ||
        input.reasoningEffort.length > 100))
  ) {
    throw new Error("INVALID_SELECTION");
  }
  return {
    provider: input.provider,
    model: input.model,
    ...(input.reasoningEffort === undefined ? {} : { reasoningEffort: input.reasoningEffort })
  };
}

async function preferences(ctx) {
  // Capture the value and revision together, before awaiting the live catalog.
  const section = ctx.settings
    .describe({ redactSecrets: true })
    .find((item) => item.ns === namespace);
  if (!section) throw new Error("SETTINGS_UNAVAILABLE");
  const catalog = await ctx.sessionController.modelCatalog();
  return {
    writable: ctx.settings.writable,
    revision: section.revision,
    selection: {
      provider: section.value.provider,
      model: section.value.model,
      ...(section.value.reasoningEffort === undefined
        ? {}
        : { reasoningEffort: section.value.reasoningEffort })
    },
    models: catalog.groups.flatMap((group) =>
      group.models.map((model) => ({
        provider: group.id,
        id: model.id,
        name: model.name,
        efforts: model.reasoning?.efforts.map(({ id, name }) => ({ id, name })) ?? [],
        ...(model.reasoning?.defaultEffort === undefined
          ? {}
          : { defaultEffort: model.reasoning.defaultEffort })
      }))
    ),
    catalogIncomplete: catalog.failures.length > 0
  };
}

export function registerModelPreferences(ctx, secret, { matchesSecret, readBody }) {
  return ctx.webServer.register({
    kind: "exact",
    path: "/fitness-model-preferences",
    handler: async (request, response) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      const reply = (status, body) => {
        response.writeHead(status);
        response.end(JSON.stringify(body));
      };
      if (!matchesSecret(request.headers["x-fitness-bridge-secret"], secret)) {
        reply(401, { ok: false, error: "unauthorized" });
        return;
      }
      if (!["GET", "PUT"].includes(request.method)) {
        reply(405, { ok: false, error: "method not allowed" });
        return;
      }
      try {
        if (request.method === "PUT") {
          if (!ctx.settings.writable) {
            reply(403, { ok: false, error: "DSH 模型设置为只读。" });
            return;
          }
          let input, selection;
          try {
            input = JSON.parse(await readBody(request));
            selection = parseSelection(input);
            const models = await ctx.llm.listModels(selection.provider);
            if (!models.some((model) => model.id === selection.model))
              throw new Error("UNKNOWN_MODEL");
            // The adapter validates supported efforts. Keep absence as inheritance,
            // instead of pinning the default materialized by resolveCallConfig.
            await ctx.llm.resolveCallConfig(selection);
          } catch {
            reply(422, { ok: false, error: "模型或思考强度不可用，请重新读取后选择。" });
            return;
          }
          await ctx.settings.replace(namespace, selection, input.revision);
        }
        reply(200, { ok: true, preferences: await preferences(ctx) });
      } catch (error) {
        const conflict = error?.code === "SETTINGS_CONFLICT";
        reply(conflict ? 409 : 503, {
          ok: false,
          error: conflict
            ? "DSH 设置已在其他位置修改，请重新读取后再保存。"
            : "DSH 模型设置暂时不可用，请稍后重新读取。"
        });
      }
    }
  });
}
