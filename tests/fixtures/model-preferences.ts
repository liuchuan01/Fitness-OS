export function modelPreferencesFixture() {
  return {
    writable: true,
    revision: 0,
    selection: { provider: "deepseek-official", model: "fixture-flash" } as {
      provider: string;
      model: string;
      reasoningEffort?: string;
    },
    models: [
      {
        provider: "deepseek-official",
        id: "fixture-flash",
        name: "DSH 测试 Flash",
        efforts: [
          { id: "off", name: "Off" },
          { id: "high", name: "High" }
        ],
        defaultEffort: "high"
      },
      {
        provider: "deepseek-official",
        id: "fixture-pro",
        name: "DSH 测试 Pro",
        efforts: [
          { id: "low", name: "Low" },
          { id: "max", name: "Max" }
        ],
        defaultEffort: "low"
      },
      { provider: "deepseek-official", id: "fixture-plain", name: "DSH 测试 Plain", efforts: [] }
    ],
    catalogIncomplete: false
  };
}
