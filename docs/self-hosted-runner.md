# Self-hosted CI runner

CI runs on a runner on your own machine rather than a GitHub-hosted VM, because
Actions minutes are metered on a private repository and this one exhausted them.

> **This repository must stay private while CI targets a self-hosted runner.**
> On a public repository, anyone can open a pull request from a fork, and its
> workflow would execute that fork's code on this machine. Private repos only
> run workflows for people with write access, which is what makes this safe.
> If you ever make the repo public, move `runs-on` back to `ubuntu-latest`
> first — Actions are free for public repositories anyway.

## Install

Everything below runs on the machine that will host the runner. It downloads a
binary from GitHub and installs a background service, so run it yourself rather
than delegating it.

**1. Get a registration token** (valid one hour):

```bash
gh api -X POST repos/William-S-Gray/agriconnect-marketplace/actions/runners/registration-token \
  --jq .token
```

Or take the ready-made commands from
*Settings → Actions → Runners → New self-hosted runner*, which include the token.

**2. Download and configure:**

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner

# Resolved rather than pinned: the download URL embeds the version, so a pinned
# one goes stale and fails with a 404 the first time you follow these steps.
VERSION=$(gh api repos/actions/runner/releases/latest --jq .tag_name | tr -d v)
curl -o actions-runner-linux-x64.tar.gz -L \
  "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-linux-x64-${VERSION}.tar.gz"
tar xzf actions-runner-linux-x64.tar.gz

./config.sh \
  --url https://github.com/William-S-Gray/agriconnect-marketplace \
  --token <TOKEN_FROM_STEP_1> \
  --name "$(hostname)" \
  --labels self-hosted,linux,x64 \
  --unattended
```

**3. Install as a service** so it survives logout and reboot:

```bash
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
sudo ./svc.sh status
```

## What the runner needs

- **Docker, usable without `sudo`.** The `verify` job starts Postgres and Redis
  as service containers. If `docker info` fails for the runner's user, add it to
  the `docker` group and restart the service.
- **Node is not required up front.** `actions/setup-node` installs Node 22 into
  the runner's tool cache on first run.
- **Ports 55433 and 56380 free.** The service containers deliberately avoid
  5432 and 6379: a workstation usually has something on those already, and the
  bind failure kills the job before any test runs.

## Things that behave differently from a hosted runner

- **Jobs queue instead of failing when the runner is offline.** A pull request
  check that sits "pending" forever usually means the machine is off or the
  service stopped — check `sudo ./svc.sh status`.
- **The workspace persists between runs.** A hosted VM starts empty every time.
  `actions/checkout` is configured with `clean: true` so a previous branch's
  leftovers do not leak into the next run.
- **One runner means jobs run one at a time.** `verify` and `secrets` no longer
  run in parallel, so a full run takes about as long as both combined.
- **A dependency problem can hide.** `npm ci` populates a cache that persists,
  so a fresh-checkout dependency failure — the class of bug that took five runs
  to diagnose when CI was first set up — is less likely to surface here than on
  a clean VM.

## Removing it

```bash
cd ~/actions-runner
sudo ./svc.sh stop && sudo ./svc.sh uninstall
./config.sh remove --token <NEW_TOKEN>
```

Then set `runs-on` back to `ubuntu-latest` in `.github/workflows/ci.yml`.
