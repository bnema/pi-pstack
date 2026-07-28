#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push("skills", "docs");

const replacements = [
  [/~\/\.cursor\/skills\//g, "~/.pi/agent/skills/"],
  [/\.cursor\/skills\//g, ".pi/skills/"],
  [/~\/\.cursor\/rules\/pstack-models\.mdc/g, "~/.pi/agent/pstack-models.json"],
  [/Cursor's built-in `create-skill` skill/g, "Pi's skill-authoring workflow"],
  [/Cursor's built-in \*\*babysit\*\* skill/g, "the available GitHub or code-review skill"],
  [/Cursor's built-in \*\*babysit\*\*/g, "the available GitHub or code-review skill"],
  [/Cursor's built-in \*\*create-skill\*\* skill/g, "Pi's skill-authoring workflow"],
  [/Cursor's built-in `create-skill`/g, "Pi's skill-authoring workflow"],
  [/the `Task` tool/g, "the `pstack_task` tool"],
  [/the Task tool/g, "the `pstack_task` tool"],
  [/`Task` subagent/g, "`pstack_task` child agent"],
  [/Task subagent/g, "pstack child agent"],
  [/`Task` calls/g, "`pstack_task` calls"],
  [/`Task` call/g, "`pstack_task` call"],
  [/Task calls/g, "pstack_task calls"],
  [/Task response/g, "pstack_task result"],
  [/subagent_type: `generalPurpose`/g, "`poteto`: `false`"],
  [/`subagent_type`: `generalPurpose`/g, "`poteto`: `false`"],
  [/subagent_type: "generalPurpose"/g, "`poteto`: `false`"],
  [/`subagent_type`: `poteto-agent`/g, "`poteto`: `true`"],
  [/subagent_type: "poteto-agent"/g, "`poteto`: `true`"],
  [/`run_in_background: true`/g, "one shared `tasks` array"],
  [/run_in_background: true/g, "one shared `tasks` array"],
  [/`readonly`: `true`/g, "`tools`: `[\"read\", \"grep\", \"find\", \"ls\"]`"],
  [/`readonly`: `false` \(agent mode\)/g, "omit `tools` only when the child needs the normal Pi toolset"],
  [/readonly: false/g, "the normal Pi toolset"],
  [/readonly strips MCP/g, "a narrow tool allowlist can hide required integration tools"],
  [/Readonly\/Ask mode strips MCPs/g, "A narrow tool allowlist can hide MCP tools"],
  [/readonly\/Ask mode strips MCPs/g, "a narrow tool allowlist can hide MCP tools"],
  [/AskQuestion/g, "the available structured question tool"],
  [/~\/\.cursor\/plugins\//g, "Pi-installed package paths under `~/.pi/agent/`"],
  [/~\/\.cursor\/projects\/\*\//g, "other directories under `~/.pi/agent/sessions/`"],
  [/Cursor's `\/loop` command/g, "an available scheduler or external watcher"],
  [/Cursor's built-in wake mechanism/g, "an optional scheduler or external watcher"],
  [/restart Cursor/g, "restart Pi"],
  [/In a Cursor chat/g, "In Pi"],
  [/Cursor confirms the plugin is installed\./g, "Confirm the package with `pi list`."],
  [/from the Cursor environment/g, "from Pi's available tools"],
  [/the `mcps\/` directory Cursor exposes for enabled MCP servers/g, "the MCP gateway's server list and instructions"],
  [/Cursor's built-in PR tools/g, "an installed GitHub or code-review integration"],
  [/\(Cursor's built-in for authoring SKILL\.md files\)/g, "(following Pi's skill documentation)"],
  [/`claude-fable-5-thinking-max`/g, "`inherit-parent`"],
  [/`gpt-5\.6-sol-max`/g, "`inherit-parent`"],
  [/`grok-4\.5-fast-xhigh`/g, "`inherit-parent`"],
  [/`claude-opus-5-thinking-xhigh`/g, "`inherit-parent`"],
];

function files(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((entry) => files(join(path, entry)));
}

for (const root of roots) {
  for (const path of files(root).filter((candidate) => candidate.endsWith(".md"))) {
    const original = readFileSync(path, "utf8");
    const adapted = replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), original);
    if (adapted !== original) writeFileSync(path, adapted);
  }
}
