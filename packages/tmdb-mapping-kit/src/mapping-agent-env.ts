export type MappingModelSelection = {
  providerID: string;
  modelID: string;
  apiKey: string;
  baseUrl?: string;
};

export function envValue(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value) return value;
  }
  return undefined;
}

function requiredEnv(env: NodeJS.ProcessEnv, names: string[], message: string): string {
  const value = envValue(env, names);
  if (!value) throw new Error(message);
  return value;
}

export function modelSelection(env: NodeJS.ProcessEnv): { providerID: string; modelID: string } {
  const rawModel = requiredEnv(env, ["PI_MODEL", "OPENCODE_MODEL"], "PI_MODEL or OPENCODE_MODEL is required");
  const providerFromEnv = envValue(env, ["PI_PROVIDER", "OPENCODE_PROVIDER"]);
  if (providerFromEnv) return { providerID: providerFromEnv, modelID: rawModel };
  const separator = rawModel.indexOf("/");
  if (separator === -1) {
    throw new Error("PI_MODEL or OPENCODE_MODEL must be provider/model unless PI_PROVIDER or OPENCODE_PROVIDER is set");
  }
  return { providerID: rawModel.slice(0, separator), modelID: rawModel.slice(separator + 1) };
}

export function mappingModelSelection(env: NodeJS.ProcessEnv): MappingModelSelection {
  return {
    ...modelSelection(env),
    apiKey: requiredEnv(env, ["PI_API_KEY", "OPENCODE_API_KEY"], "PI_API_KEY or OPENCODE_API_KEY is required"),
    baseUrl: envValue(env, ["PI_BASE_URL", "OPENCODE_BASE_URL"]),
  };
}
