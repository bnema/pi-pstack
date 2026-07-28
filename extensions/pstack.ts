import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Message } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POTETO_SKILL = resolve(PACKAGE_ROOT, "skills", "poteto-mode", "SKILL.md");
const MAX_TASKS = 8;
const MAX_CONCURRENCY = 4;
const MAX_OUTPUT_BYTES = 50 * 1024;
const DEFAULT_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TASK_TIMEOUT_MS = 30 * 60 * 1000;

interface TaskInput {
  task: string;
  model?: string;
  cwd?: string;
  poteto?: boolean;
  tools?: string[];
  timeoutMs?: number;
}

interface TaskResult {
  task: string;
  model: string;
  exitCode: number;
  output: string;
  stderr: string;
  stopReason?: string;
}

interface PstackDetails {
  mode: "single" | "parallel";
  results: TaskResult[];
}

const TaskSchema = Type.Object({
  task: Type.String({ description: "Complete, self-contained task for the isolated agent" }),
  model: Type.Optional(
    Type.String({ description: "Pi model as provider/model. Omit, auto, or inherit-parent to use the parent model" }),
  ),
  cwd: Type.Optional(Type.String({ description: "Working directory. Defaults to the parent session cwd" })),
  poteto: Type.Optional(
    Type.Boolean({ description: "Load poteto-mode in the child agent. Defaults to false" }),
  ),
  tools: Type.Optional(
    Type.Array(Type.String(), { description: "Child tool allowlist, such as read,grep,find,ls" }),
  ),
  timeoutMs: Type.Optional(
    Type.Integer({
      description: `Maximum child runtime in milliseconds. Defaults to ${DEFAULT_TASK_TIMEOUT_MS}; maximum ${MAX_TASK_TIMEOUT_MS}`,
      minimum: 1_000,
      maximum: MAX_TASK_TIMEOUT_MS,
    }),
  ),
});

const Parameters = Type.Object({
  task: Type.Optional(Type.String({ description: "Single task to run" })),
  model: Type.Optional(
    Type.String({ description: "Model for single mode. Omit, auto, or inherit-parent to use the parent model" }),
  ),
  cwd: Type.Optional(Type.String({ description: "Working directory for single mode" })),
  poteto: Type.Optional(Type.Boolean({ description: "Load poteto-mode in single mode" })),
  tools: Type.Optional(Type.Array(Type.String(), { description: "Child tool allowlist for single mode" })),
  timeoutMs: Type.Optional(
    Type.Integer({
      description: `Maximum child runtime in milliseconds. Defaults to ${DEFAULT_TASK_TIMEOUT_MS}; maximum ${MAX_TASK_TIMEOUT_MS}`,
      minimum: 1_000,
      maximum: MAX_TASK_TIMEOUT_MS,
    }),
  ),
  tasks: Type.Optional(
    Type.Array(TaskSchema, {
      description: `Parallel tasks. Maximum ${MAX_TASKS}; at most ${MAX_CONCURRENCY} run concurrently`,
      maxItems: MAX_TASKS,
    }),
  ),
});

function piInvocation(args: string[]): { command: string; args: string[] } {
  const script = process.argv[1];
  if (script && !script.startsWith("/$bunfs/root/")) {
    return { command: process.execPath, args: [script, ...args] };
  }
  return { command: "pi", args };
}

function finalText(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const text = message.content.find((part) => part.type === "text");
    if (text?.type === "text") return text.text;
  }
  return "";
}

function truncate(text: string): string {
  if (Buffer.byteLength(text, "utf8") <= MAX_OUTPUT_BYTES) return text;
  let content = text.slice(0, MAX_OUTPUT_BYTES);
  while (Buffer.byteLength(content, "utf8") > MAX_OUTPUT_BYTES) content = content.slice(0, -1);
  return `${content}\n\n[Output truncated to ${MAX_OUTPUT_BYTES} bytes.]`;
}

async function mapConcurrent<T, U>(items: T[], limit: number, run: (item: T, index: number) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runTask(
  input: TaskInput,
  defaultCwd: string,
  parentModel: string,
  signal: AbortSignal | undefined,
): Promise<TaskResult> {
  const selectedModel = !input.model || input.model === "auto" || input.model === "inherit-parent"
    ? parentModel
    : input.model;
  const args = ["--mode", "json", "-p", "--no-session", "--model", selectedModel];
  if (input.poteto) args.push("--skill", POTETO_SKILL);
  if (input.tools?.length) args.push("--tools", input.tools.join(","));
  args.push(input.poteto ? `/skill:poteto-mode ${input.task}` : input.task);

  const messages: Message[] = [];
  let stderr = "";
  let stopReason: string | undefined;
  let buffer = "";
  let aborted = false;
  let timedOut = false;
  let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
  const invocation = piInvocation(args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: input.cwd ?? defaultCwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const processLine = (line: string) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line) as { type?: string; message?: Message };
      if (event.type === "message_end" && event.message) {
        messages.push(event.message);
        if (event.message.role === "assistant") stopReason = event.message.stopReason;
      }
    } catch {
      // Pi JSON mode may emit non-event diagnostics. Stderr remains available for failures.
    }
  };

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const stopChild = (reason: "aborted" | "timeout") => {
    if (reason === "aborted") aborted = true;
    else timedOut = true;
    child.kill("SIGTERM");
    forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    forceKillTimer.unref();
  };
  const abort = () => stopChild("aborted");
  const timeoutId = setTimeout(() => stopChild("timeout"), input.timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS);
  timeoutId.unref();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });

  const exitCode = await new Promise<number>((complete) => {
    child.on("error", () => complete(1));
    child.on("close", (code) => complete(code ?? 1));
  });
  clearTimeout(timeoutId);
  if (forceKillTimer) clearTimeout(forceKillTimer);
  signal?.removeEventListener("abort", abort);
  if (buffer.trim()) processLine(buffer);

  return {
    task: input.task,
    model: selectedModel,
    exitCode: timedOut ? 124 : aborted ? 130 : exitCode,
    output: truncate(finalText(messages) || stderr || (timedOut ? "(timed out)" : "(no output)")),
    stderr: truncate(stderr),
    stopReason: timedOut ? "timeout" : aborted ? "aborted" : stopReason,
  };
}

export default function pstack(pi: ExtensionAPI) {
  let modeEnabled = false;

  const setMode = (enabled: boolean) => {
    if (modeEnabled === enabled) return;
    modeEnabled = enabled;
    pi.appendEntry("pstack-mode", { enabled });
  };

  pi.on("session_start", (_event, ctx) => {
    modeEnabled = false;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom" || entry.customType !== "pstack-mode") continue;
      const data = entry.data as { enabled?: boolean } | undefined;
      modeEnabled = data?.enabled === true;
    }
    if (modeEnabled) ctx.ui.setStatus("pstack", "poteto");
  });

  pi.on("input", (event, ctx) => {
    if (!event.text.startsWith("/skill:poteto-mode")) return;
    setMode(true);
    ctx.ui.setStatus("pstack", "poteto");
  });

  pi.on("before_agent_start", (event) => {
    if (!modeEnabled) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\nPoteto mode is active. Apply the poteto-mode skill when this turn matches a playbook or otherwise needs rigor. Stay concise for casual turns.`,
    };
  });

  pi.registerCommand("pstack", {
    description: "Enable poteto-mode and run a task, or show pstack help",
    handler: async (args, ctx) => {
      const task = args.trim();
      if (!task) {
        ctx.ui.notify("Use /pstack <task>, /skill:poteto-mode, or the pstack_task tool.", "info");
        return;
      }
      setMode(true);
      ctx.ui.setStatus("pstack", "poteto");
      pi.sendUserMessage(`/skill:poteto-mode ${task}`);
    },
  });

  pi.registerCommand("pstack-off", {
    description: "Disable sticky poteto-mode reminders",
    handler: async (_args, ctx) => {
      setMode(false);
      ctx.ui.setStatus("pstack", undefined);
      ctx.ui.notify("Poteto mode disabled.", "info");
    },
  });

  const skillAliases: Record<string, string> = {
    "poteto-mode": "Run pstack's main rigorous workflow router",
    "setup-pstack": "Configure pstack model roles",
    how: "Explain how a subsystem works",
    why: "Investigate why a system was designed this way",
    recall: "Rebuild recent project context",
    "blast-radius": "Trace what a change could affect",
    architect: "Explore and settle a design before implementation",
    arena: "Run parallel candidates and synthesize the best result",
    interrogate: "Run adversarial multi-model review",
    "automate-me": "Capture personal working conventions as a skill",
    reflect: "Extract durable lessons from the active session",
    teach: "Teach a change or subsystem",
    tdd: "Use a focused red-green-refactor loop",
    "figure-it-out": "Design a rigorous bespoke playbook",
    "show-me-your-work": "Keep an auditable decision trail",
    "create-verification-skill": "Create a project verification skill",
    "maintain-verification-skill": "Refresh a project verification skill",
    unslop: "Tighten human-facing prose",
  };
  for (const [name, description] of Object.entries(skillAliases)) {
    pi.registerCommand(name, {
      description,
      handler: async (args, ctx) => {
        if (name === "poteto-mode") {
          setMode(true);
          ctx.ui.setStatus("pstack", "poteto");
        }
        pi.sendUserMessage(`/skill:${name}${args.trim() ? ` ${args.trim()}` : ""}`);
      },
    });
  }

  pi.registerTool({
    name: "pstack_task",
    label: "Pstack Task",
    description: [
      "Run one isolated Pi agent or a parallel batch.",
      "Use poteto=true for pstack implementation delegates; leave it false for independent reviewers.",
      `Parallel batches support at most ${MAX_TASKS} tasks and ${MAX_CONCURRENCY} concurrent processes.`,
      `Each returned agent output is truncated to ${MAX_OUTPUT_BYTES} bytes.`,
    ].join(" "),
    promptSnippet: "Delegate isolated work to one or more Pi agents, optionally under poteto-mode",
    promptGuidelines: [
      "Use pstack_task for pstack playbook delegation and parallel review; give every task a complete brief and isolated write scope.",
      "Review pstack_task results and changed files yourself before accepting delegated work.",
    ],
    parameters: Parameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const hasSingle = typeof params.task === "string" && params.task.trim().length > 0;
      const hasParallel = (params.tasks?.length ?? 0) > 0;
      if (Number(hasSingle) + Number(hasParallel) !== 1) {
        throw new Error("Provide exactly one of task or tasks");
      }
      if (params.tasks && params.tasks.length > MAX_TASKS) {
        throw new Error(`At most ${MAX_TASKS} parallel tasks are allowed`);
      }
      if (!ctx.model) throw new Error("pstack_task requires an active parent model");

      const parentModel = `${ctx.model.provider}/${ctx.model.id}`;
      const inputs: TaskInput[] = hasParallel
        ? params.tasks!
        : [{
            task: params.task!,
            model: params.model,
            cwd: params.cwd,
            poteto: params.poteto,
            tools: params.tools,
            timeoutMs: params.timeoutMs,
          }];
      let completed = 0;
      const results = await mapConcurrent(inputs, MAX_CONCURRENCY, async (input) => {
        const result = await runTask(input, ctx.cwd, parentModel, signal);
        completed++;
        onUpdate?.({
          content: [{ type: "text", text: `${completed}/${inputs.length} pstack tasks complete` }],
          details: { mode: hasParallel ? "parallel" : "single", results: [] } satisfies PstackDetails,
        });
        return result;
      });
      const details: PstackDetails = { mode: hasParallel ? "parallel" : "single", results };
      const succeeded = results.filter((result) => result.exitCode === 0).length;
      const output = results
        .map((result, index) => `### Task ${index + 1} (${result.model}, exit ${result.exitCode})\n\n${result.output}`)
        .join("\n\n---\n\n");
      return {
        content: [{ type: "text", text: `${succeeded}/${results.length} tasks succeeded\n\n${output}` }],
        details,
      };
    },
  });
}
