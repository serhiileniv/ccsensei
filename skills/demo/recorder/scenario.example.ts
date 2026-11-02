// Copy to scenario.ts and edit. Each scene should start from a known URL (d.goto) so a retry can replay it.
// Selectors come from a live snapshot of the app; `expect` lists what must be visible when the scene starts.
import type { Director } from "./lib/director.ts";
import type { Meta, Scene } from "./lib/types.ts";

export const meta: Meta = {
  title: "Product name",
  tagline: "One line: what it does, for whom",
  url: "http://localhost:3000",
  maxSeconds: 120,
};

export const scenes: Scene[] = [
  {
    name: "open",
    caption: "One user, one problem",
    expect: ["main"],
    run: async (d: Director) => {
      await d.goto("/");
      await d.spotlight("h1", 1800);
    },
  },
  {
    name: "the-wow",
    caption: "The moment that matters",
    wow: true,
    expect: ["button"],
    run: async (d: Director) => {
      await d.click("button");
      d.fast(true); // waits get sped up in render
      await d.page.locator("text=Done").first().waitFor({ timeout: 60_000 });
      d.fast(false);
      await d.spotlight("text=Done", 2400);
    },
  },
];
