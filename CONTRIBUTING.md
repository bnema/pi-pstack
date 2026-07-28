# Contributing

Contributions should preserve the native Pi package boundary.

## Checks

```bash
npm ci
npm run check
npm pack --dry-run
```

Keep changes focused. Update the relevant skill or guide when behavior changes. Do not commit `node_modules`, session data, generated output, or credentials.

## Pull requests

Describe the user-visible behavior, the verification commands, and any Pi version assumptions. Keep upstream attribution intact when adapting pstack material.
