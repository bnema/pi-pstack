#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (!packageJson.keywords?.includes("pi-package")) errors.push("package.json must include the pi-package keyword");
if (!packageJson.pi?.extensions?.includes("./extensions/pstack.ts")) errors.push("package.json must register the pstack extension");
if (!packageJson.pi?.skills?.includes("./skills")) errors.push("package.json must register skills");

function files(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((entry) => files(join(path, entry)));
}

const skillFiles = files("skills").filter((path) => path.endsWith("SKILL.md"));
for (const path of skillFiles) {
  const text = readFileSync(path, "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    errors.push(`${path}: missing YAML frontmatter`);
    continue;
  }
  const name = frontmatter[1].match(/^name:\s*["']?([^\n"']+)/m)?.[1]?.trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) errors.push(`${path}: invalid skill name ${name ?? "(missing)"}`);
  if (!description) errors.push(`${path}: missing description`);
}

const markdown = files("skills").concat(files("docs")).filter((path) => path.endsWith(".md"));
const forbidden = [
  [/\.cursor\//, "Cursor configuration path"],
  [/subagent_type/, "Cursor subagent_type"],
  [/generalPurpose/, "Cursor generalPurpose agent"],
  [/run_in_background/, "Cursor background task flag"],
  [/Cursor's built-in/, "Cursor built-in dependency"],
];
for (const path of markdown) {
  const text = readFileSync(path, "utf8");
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) errors.push(`${path}: contains ${label}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated native Pi package metadata and ${skillFiles.length} skills.`);
