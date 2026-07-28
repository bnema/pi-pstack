# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the package

From a shell, install a local checkout or Git repository:

```bash
pi install /absolute/path/to/pi-pstack
# or: pi install https://github.com/bnema/pi-pstack
```

Confirm the package with `pi list`.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.pi/agent/pstack-models.json`, a small configuration file every pstack skill reads.

You only override what you care about. A role with no entry inherits the active parent model. To restore a default later, delete that role's line, or just run `/setup-pstack` again.

You might be wondering what happens if you use Auto. Set a role to `inherit-parent` or `auto` and `pstack_task` passes the active parent `provider/model` to the child. Both values mean the same thing, and neither is a model slug. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size.

## Accept the verification offer, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.pi/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers when it earns its place.

The next pstack workflow reads the new configuration immediately.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/pstack add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. The first item is always "read the Principles section". The rest are the matched playbook's steps copied in, the Feature playbook for this prompt. If poteto-mode skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. Poteto-mode is sticky in the Pi session. Run `/pstack-off` to disable it.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
