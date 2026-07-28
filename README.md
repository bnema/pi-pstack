# pi-pstack

A native [Pi](https://github.com/earendil-works/pi-mono) package adapted from Lauren Tan's [pstack](https://github.com/cursor/plugins/tree/main/pstack). The public repository is [bnema/pi-pstack](https://github.com/bnema/pi-pstack).

pstack favors small, well-shaped changes, deliberate parallelism, and proof against the real artifact. `poteto-mode` routes non-trivial work through focused playbooks and supporting skills.

The package requires Pi 0.82.1 or newer and Node.js 22.19 or newer.

## Install

```bash
pi install git:github.com/bnema/pi-pstack
```

For a local checkout:

```bash
pi install .
```

For a temporary local run:

```bash
pi -e . --skill ./skills/poteto-mode
```

The package manifest loads the extension and every bundled skill when installed through `pi install`.

## Start

```text
/setup-pstack
/pstack implement the feature and verify it on the real surface
```

You can also invoke the skill directly:

```text
/skill:poteto-mode investigate why requests are retried twice
```

Poteto mode stays active for later rigorous turns in the same session. Run `/pstack-off` to disable its reminder.

## Native Pi integration

`extensions/pstack.ts` provides:

- `/pstack <task>` to enable poteto-mode and start a task.
- `/pstack-off` to disable sticky mode.
- `pstack_task` to run isolated Pi child agents, including bounded parallel batches, explicit models, tool allowlists, optional poteto-mode, and a child timeout. The default timeout is 10 minutes and the maximum is 30 minutes.
- Session-backed mode state that survives reloads and session resumes.

The adapted skills use Pi paths and concepts:

- Model roles live in `~/.pi/agent/pstack-models.json`.
- Project skills live in `.pi/skills/`; user skills live in `~/.pi/agent/skills/`.
- The active transcript is available through `PI_SESSION_FILE`.
- Parallel workflows call `pstack_task` instead of a host-specific task primitive.

## Skills

`poteto-mode` is the main entry point. Situational skills include `how`, `why`, `architect`, `arena`, `interrogate`, `recall`, `reflect`, `tdd`, and `unslop`. The original principle skills and playbooks remain bundled under `skills/`.

See [`docs/guide/README.md`](docs/guide/README.md) for the longer workflow guide. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## Upstream and scope

This adaptation is based on pstack 0.11.12. It preserves the upstream MIT license and authorship.

Cursor-specific plugin metadata, the `poteto-agent` manifest, and the dormant Benny automation pack are not copied as inert files. Their useful orchestration is represented by the native extension and Pi skills. Integrations that depend on optional MCP servers or external review tools remain conditional on those tools being available in the active Pi installation.

The extension launches local Pi child processes with the selected working directory and tool permissions. Use a narrow `tools` allowlist for read-only reviews. Child output is capped at 50 KiB per task. Review the source before installation because Pi extensions run with the user's permissions.
