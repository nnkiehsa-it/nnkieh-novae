export function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function optionalEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}
