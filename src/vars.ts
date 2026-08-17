import type { EnvVar } from "./trawl";

/** Replace `{{name}}` with the project env value. Unknown names are left as
 *  written — a blank credential fails in a way that looks like a server bug. */
export function applyVars(text: string, env: EnvVar[]): string {
  return text.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (whole, name: string) => {
    const hit = env.find((v) => v.key === name);
    return hit ? hit.value : whole;
  });
}
