# Security

Pi packages run with the permissions of the user who installs them. Review the source before installing a package or enabling its extension.

Report security issues privately to the repository owner instead of opening a public issue with exploit details. Include the affected version, reproduction steps, and impact. Do not include credentials or personal data.

The `pstack_task` extension launches local Pi child processes. Child tasks inherit the selected working directory and tool permissions. Configure a bounded `timeoutMs` and use a narrow `tools` allowlist for read-only review work.
