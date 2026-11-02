const NAME = /^[a-z0-9][a-z0-9-]*$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function metaErrors(meta: unknown): string[] {
  if (!isObject(meta)) return ["meta must be an object { title, url, maxSeconds? }"];
  const errors: string[] = [];
  if (typeof meta.title !== "string" || !meta.title.trim()) errors.push("meta.title must be a non-empty string");
  if (typeof meta.url !== "string" || !URL.canParse(meta.url)) errors.push("meta.url must be an absolute URL");
  if (meta.maxSeconds !== undefined && !(typeof meta.maxSeconds === "number" && meta.maxSeconds > 0)) {
    errors.push("meta.maxSeconds must be a positive number");
  }
  return errors;
}

function sceneErrors(scene: unknown, i: number, seen: Set<string>): string[] {
  const at = `scenes[${i}]`;
  if (!isObject(scene)) return [`${at} must be an object`];
  const errors: string[] = [];
  if (typeof scene.name !== "string" || !NAME.test(scene.name)) errors.push(`${at}.name must be a lowercase slug (a-z, 0-9, -)`);
  else if (seen.has(scene.name)) errors.push(`${at}.name "${scene.name}" is a duplicate`);
  if (typeof scene.run !== "function") errors.push(`${at}.run must be a function`);
  if (scene.caption !== undefined && typeof scene.caption !== "string") errors.push(`${at}.caption must be a string`);
  if (scene.expect !== undefined && !(Array.isArray(scene.expect) && scene.expect.every((s) => typeof s === "string"))) {
    errors.push(`${at}.expect must be an array of selector strings`);
  }
  if (scene.wow !== undefined && typeof scene.wow !== "boolean") errors.push(`${at}.wow must be a boolean`);
  return errors;
}

/** Checks a loaded scenario module; returns human-readable errors, empty when valid. */
export function validateScenario(mod: unknown): string[] {
  const m = isObject(mod) ? mod : {};
  const scenes = Array.isArray(m.scenes) ? m.scenes : null;
  const seen = new Set<string>();
  const perScene = (scenes ?? []).flatMap((s, i) => {
    const errors = sceneErrors(s, i, seen);
    if (isObject(s) && typeof s.name === "string") seen.add(s.name);
    return errors;
  });
  return [
    ...(scenes?.length ? [] : ["scenes must be a non-empty array"]),
    ...metaErrors(m.meta),
    ...perScene,
  ];
}
