import type { IncomingMessage, ServerResponse } from "node:http";
import { readApplicationSettings, saveSettingsSection } from "./agent-settings.js";
import { readJsonBody, writeJson } from "./http/json.js";
import { xparseSettingsSchema } from "../shared/xparse.js";

export async function serveXparseSettings(
  request: IncomingMessage,
  response: ServerResponse,
  file: string
) {
  response.setHeader("Cache-Control", "no-store");
  try {
    if (request.method === "GET") {
      writeJson(response, 200, {
        ok: true,
        settings: (await readApplicationSettings(file)).xparse
      });
    } else if (request.method === "PUT") {
      const settings = xparseSettingsSchema.parse(await readJsonBody(request));
      await saveSettingsSection(file, "xparse", settings);
      writeJson(response, 200, { ok: true, settings });
    } else {
      writeJson(response, 405, { ok: false, error: "不支持的请求方法" });
    }
  } catch {
    writeJson(response, 422, {
      ok: false,
      error: "文件解析设置读取或保存失败，请检查配置后重试。"
    });
  }
}
