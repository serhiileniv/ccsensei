import type { Scene } from "./types.ts";

export const EXPECT_TIMEOUT_MS = 5000;

/** The slice of a Playwright Page that preflight needs; tests pass a fake. */
export interface PageLike {
  locator(selector: string): { first(): { waitFor(o: { state: "visible"; timeout: number }): Promise<unknown> } };
}

type SceneLike = Pick<Scene, "name" | "expect">;
export type PreflightResult = { ok: true } | { ok: false; scene: string; selector?: string; error: string };

const message = (err: unknown): string => (err instanceof Error ? err.message.split("\n")[0] : String(err));

/** Returns the first selector of the scene that is not visible, or null. */
export async function missingSelector(page: PageLike, scene: SceneLike, timeout = EXPECT_TIMEOUT_MS): Promise<string | null> {
  for (const selector of scene.expect ?? []) {
    const visible = await page.locator(selector).first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
    if (!visible) return selector;
  }
  return null;
}

/** Checks each scene's selectors, then runs it (dry) so the next scene sees the right state. Stops at the first failure. */
export async function preflight<S extends SceneLike>(
  page: PageLike,
  scenes: S[],
  runScene: (scene: S) => Promise<void>,
  timeout = EXPECT_TIMEOUT_MS,
): Promise<PreflightResult> {
  for (const scene of scenes) {
    const selector = await missingSelector(page, scene, timeout);
    if (selector) return { ok: false, scene: scene.name, selector, error: "not visible" };
    try {
      await runScene(scene);
    } catch (err) {
      return { ok: false, scene: scene.name, error: message(err) };
    }
  }
  return { ok: true };
}

export function formatResult(r: PreflightResult): string {
  if (r.ok) return "PASS all scenes";
  return r.selector ? `FAIL scene "${r.scene}": selector ${r.selector} ${r.error}` : `FAIL scene "${r.scene}": ${r.error}`;
}

export async function checkHealth(url: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(url);
    return res.ok ? null : `health ${url} returned ${res.status}`;
  } catch (err) {
    return `health ${url} unreachable: ${message(err)}`;
  }
}
