# GitHub Copilot cloud agent environment

PlayaPlan uses
[`.github/workflows/copilot-setup-steps.yml`](../.github/workflows/copilot-setup-steps.yml)
to prepare the ephemeral GitHub Actions environment used by GitHub Copilot
cloud agent. It is not the setup procedure for a developer's local checkout.
For local development, use [`setup.md`](./setup.md).

GitHub documents this workflow in
[Customizing the development environment for GitHub Copilot cloud agent](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/customize-the-agent-environment).

## What the workflow provides

Before the cloud agent starts working, the `copilot-setup-steps` job:

- Starts PostgreSQL for the agent session
- Checks out the repository
- Installs Node.js 22
- Creates the root `.env`
- Installs all npm workspace dependencies
- Generates the Prisma client
- Applies committed database migrations
- Seeds the agent's database

The environment is temporary and exists only for the cloud agent session.

## Workflow requirements

- The file must remain at `.github/workflows/copilot-setup-steps.yml`.
- The job must remain named `copilot-setup-steps`.
- The workflow must be present on the repository's default branch before cloud
  agent sessions can use it.
- The workflow can be run manually from the repository's **Actions** tab to
  validate changes.

The workflow should install deterministic prerequisites only. The cloud agent
can run the normal repository scripts after setup:

```bash
npm run build
npm run lint
npm test
```

For cloud-agent-only secrets or variables, configure them on the repository's
`copilot` GitHub Actions environment rather than committing them to this file.