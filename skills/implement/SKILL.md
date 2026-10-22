---
name: implement
description: Write code test-first (red, green, refactor, one test at a time), for bugs and features alike. Use to implement an approved spec, fix a bug, or add behaviour.
argument-hint: "<bug | behaviour | docs/specs/<slug>.md>"
---

# /ccs:implement

Code is done when a test that used to fail now passes, and the suite is green.

## Step 0 — route

- Non-trivial and no spec → `/ccs:spec` first.
- A bug whose cause is not established → `/ccs:root-cause` first, then take its root
  cause and evidence rather than re-deriving them. Fixing an untraced symptom produces a
  second bug behind the first.
- No test runner in the repo → stop and say so. Choosing one is a spec.

## Step 1 — test list

Read the code the change touches and trace the real flow before listing anything. The
smallest change in the wrong place is a second bug.

- From a spec: one line per acceptance criterion.
- From a bug: one line, the reproduction.
- Otherwise: one line per behaviour in the request.

A criterion no test can check stays on the list as `manual: <why>` — never dropped.
Show the list before writing code.

## Step 2 — red

One test, where the repo already keeps its tests, in the style already used there. It
asserts behaviour through the public interface, not internals or the current output.

Run it. **Watch it fail for the reason you stated.** A compile error or a setup mistake
is not red. A test you never saw fail is not evidence.

## Step 3 — green

Smallest code that makes that test pass. Stop at the first rung that holds:
not needed → skip · already in the repo → reuse · stdlib, platform or an installed
dependency → use it · one line → one line · else the minimum that works.
Two options the same size → the one correct on edge cases.

- A bug: grep every caller of what you touch; fix it once, where they all route through.
- A new dependency is a design change → step 5.
- Never cut: validation at trust boundaries, data-loss handling, security, accessibility,
  anything requested.
- A shortcut with a known ceiling gets a one-line comment: the ceiling, and when to upgrade.
- No code for tests not yet written. No refactors, cleanups or renames mixed in.

## Step 4 — refactor

Only on green. Aim it at the next reader:

- Follow the conventions of the files you touch: naming, layering, error handling.
- No abstraction nobody asked for: no one-implementation interface, no config for a
  constant, no scaffolding for later.
- Remove duplication you introduced. Boring over clever. Fewest files.
- Delete what you made dead: unused code, imports, commented-out lines.

Run the full suite after.

## Step 5 — next

Tick the item, back to step 2. New behaviour, or a second bug, found on the way → append
it to the list. Never build it silently.

A design change mid-way → stop. Update the spec, or run `/ccs:spec` if there is none.

## Step 6 — done

- the full suite passes — run it, do not assume
- the repo's typecheck and lint gates pass, if it has them

Report each list item → test name or `manual`, then the actual suite output. For a bug,
add the root cause in one line. What you skipped, one line each: `skipped: X, add when Y`.

Do not commit. The user commits. Before a PR, suggest `/ccs:review`. Then write the report (below).

## Writing

One line where one line does. Answer first. State the fact, not the story behind it — no
narrating what was tried, no paragraph restating the line above.
Two things always stay: **why** a non-obvious decision was made, and **what a check cannot do**.
Caveats and risks still get said, one line each.

Outcome: success = every list item green or `manual`, suite green · partial = items left · failed = suite red, or stopped.

## Report

Last step, every run, whatever the outcome: write `.ccs/reports/<skill>/<YYYY-MM-DD>-<slug>.md`
at the repo root, and add `.ccs/` to `.git/info/exclude` if missing. One line per field,
no secrets, tokens or customer data. Print the path.

```
---
skill: <skill>
date: <YYYY-MM-DD>
repo: <owner/name>
target: <argument, one line>
outcome: success | partial | failed
learned: false
---

Used: <tools, CLIs, MCPs, files that did the work>
Found: <the result, one or two lines>
Friction: <what slowed or blocked it; a user correction; "none">
```
