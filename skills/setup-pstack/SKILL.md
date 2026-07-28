---
name: setup-pstack
description: Configure which Pi models pstack uses per role. Detects available provider/model specs and writes pstack's user configuration. Use for /setup-pstack, "configure pstack models", or changing pstack model choices.
---

# Setup pstack

Write `~/.pi/agent/pstack-models.json`. Pstack skills read this file when they delegate through `pstack_task`. Missing roles inherit the active parent model.

## 1. Detect models

Run `pi --list-models` and collect the available `provider/model` specs. Treat that output as authoritative. `inherit-parent` and `auto` are aliases for the active parent model and are always valid.

## 2. Load current state

Read the existing JSON file when present. Otherwise start with the defaults below. Every scalar role defaults to `inherit-parent`; every panel defaults to a one-element `inherit-parent` list. This is portable and avoids inventing unavailable model names.

## 3. Choose roles

Show the current mapping. Use the available structured question tool when the user wants changes. Offer only detected model specs plus `inherit-parent` and `auto`.

Panel arrays set fan-out. One `pstack_task` child runs per entry. Recommend model-family diversity for review panels when the user has several providers configured, but do not require it.

## 4. Validate and write

Reject every non-alias value that was not present in `pi --list-models`. Create the parent directory and overwrite the whole file so reruns are idempotent.

```json
{
  "feature, refactoring": "inherit-parent",
  "bug-fix": "inherit-parent",
  "perf-issue": "inherit-parent",
  "hillclimb": "inherit-parent",
  "judgment and prose": "inherit-parent",
  "hardest tasks": "inherit-parent",
  "how explorer": "inherit-parent",
  "how explainer": "inherit-parent",
  "how critics": ["inherit-parent"],
  "why investigators": "inherit-parent",
  "why synthesizer": "inherit-parent",
  "reflect tooling": "inherit-parent",
  "reflect judgment, divergent, synthesizer": "inherit-parent",
  "arena runners": ["inherit-parent"],
  "arena cross-judge pool": ["inherit-parent"],
  "architect runners": ["inherit-parent"],
  "interrogate reviewers": ["inherit-parent"]
}
```

Tell the user which path was written. New `pstack_task` calls use it immediately because the skills read configuration at invocation time.

## Optional verification skill

If the project has no real-surface verification harness, offer once to run `/skill:create-verification-skill`. Do not push after a refusal.
