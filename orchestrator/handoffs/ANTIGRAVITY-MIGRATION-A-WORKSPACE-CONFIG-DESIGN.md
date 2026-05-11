# ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN

**Phase identity:** `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN`
**Phase mode (source):** Mode 2 / DESIGN-ONLY (conversation)
**Source-design HEAD anchor:** `71af035f9a1f7489bfd663e099a15fda7439d0a7` (= ANTIGRAVITY-MIGRATION-DESIGN-SPEC)
**Parent design:** `orchestrator/handoffs/ANTIGRAVITY-MIGRATION-DESIGN.md` (§4–§11 high-level rules; this design translates them into concrete workspace configuration)
**Codification phase:** `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC` (DOCS-ONLY / Mode 3)
**Future operator-manual execution phase (separately gated; NOT authorized by this DESIGN):** `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG`

This document persists the Codex-PASS workspace-config design as a SAFE-class handoff record. The design translates the Codex-PASS parent design (`ANTIGRAVITY-MIGRATION-DESIGN-SPEC` at `71af035…`) into concrete, actionable workspace configuration that a future operator-manual execution phase would follow when establishing the Antigravity workspace. All 10 DPI items (DPI-WC-1 through DPI-WC-10) are resolved per operator answers. Codex DESIGN-ONLY round-1 review returned overall PASS across all 13 narrow goals plus sentence-level forbidden-content checks; no required edits issued. The document is NOT approval to install Google Antigravity IDE, NOT approval to configure any workspace, NOT a credential grant, NOT a deploy.

---

## §0 — Phase classification & DPI resolution summary

| Property | Value |
|---|---|
| Phase name | `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN` |
| Phase mode (source) | Mode 2 / DESIGN-ONLY (conversation-only) |
| Codification phase | `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC` (DOCS-ONLY / Mode 3) |
| Source-design HEAD anchor | `71af035f9a1f7489bfd663e099a15fda7439d0a7` |
| Parent design anchor | `71af035…` (ANTIGRAVITY-MIGRATION-DESIGN-SPEC) |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Resolved DPI summary (operator answers):**

| DPI | Operator answer | Design implication |
|---|---|---|
| DPI-WC-1 | Both `agent-avila` + `agent-avila-relay` in workspace scope | §1 includes both repos |
| DPI-WC-2 | **Workspace-level exclusion only; do not rely on per-file redaction** | §2 hardens to workspace-level exclude; defensive operator rule for accidental opens |
| DPI-WC-3 | Empty test whitelist by default | §3 test caveat = empty set |
| DPI-WC-4 | **Assume Antigravity inherits full shell env; high caution** | §4 + §5 enforce at command level, not env-restriction level |
| DPI-WC-5 | **Zero git credentials in Antigravity** | §6 layer-2 hardened: no SSH key / GitHub PAT / `gh auth`; network ops physically impossible |
| DPI-WC-6 | Method C (branch-based) **off-table** | §7 supports only methods A (copy-paste) + B (`/tmp/` scratch file) |
| DPI-WC-7 | **Mandate transfer-log section in future handoffs** | §7 transfer-log template required for future handoffs with Antigravity-originated content |
| DPI-WC-8 | Allow `node --check <file.js>` only; no project execution | §3 includes `node --check`; §4 reinforces no project execution |
| DPI-WC-9 | Future separate phase `ANTIGRAVITY-RULES-DESIGN` (not this design) | §9 explicitly excludes from this design's authorization |
| DPI-WC-10 | Built-in web browser allowed for public docs only; private/internal resources forbidden | §3 + §4 cover browser scope |

**Codex review history (source design phase):**
- Round-1 DESIGN-ONLY: **overall PASS** across all 13 narrow goals (read-only repos, complete exclusions, no-secret access, read-only commands, comprehensive forbidden list, zero-credentials posture, copy-paste/`/tmp/` only transfer, method C off-table, transfer-log mandate clear, mandatory Codex review, no install/config authorization, Relay+Autopilot DORMANT, approvers `{Victor}` preserved) plus sentence-level forbidden-content checks. **No required edits issued.**

---

## §1 — Allowed repos (per DPI-WC-1)

**Two repos, read-only access to existing local working trees:**

| Repo | Local working-tree path | Access |
|---|---|---|
| `relentlessvic/agent-avila` | `/Users/victormercado/claude-tradingview-mcp-trading/` | Read-only |
| `relentlessvic/agent-avila-relay` | `/Users/victormercado/code/agent-avila-relay/` | Read-only |

**Workspace setup recommendation:** Open BOTH repo working trees in Antigravity as a multi-root workspace (preferred) OR open them as separate Antigravity windows. Antigravity reads the **already-cloned local working trees** maintained by Claude Code — does NOT clone fresh. Updates flow when operator runs `git fetch` / `git pull` in the Claude Code session.

**Repos NOT in scope (firm):**
- Any other GitHub repo the operator owns
- Any other directory containing trading code, secrets, or production state
- Any monorepo paths outside the two listed

---

## §2 — Excluded files (per DPI-WC-2)

Per DPI-WC-2, Antigravity is treated as if it has **no per-file redaction capability**. Workspace-level exclusion is the only enforcement layer. If a file is excluded, it MUST be invisible to Antigravity's file explorer, search, and agent context windows.

**Always-exclude inside both allowed repo working trees (firm; workspace-level enforcement):**
- `.env`
- `.env.*` (any environment files)
- `.envrc` (direnv files)
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer` (any certs/keys)
- `position.json`
- `position.json.snap.*` (any snapshot of position state)
- Any directory named `secrets/`, `credentials/`, or `.secrets/`

**Always-exclude outside both repo working trees (entire paths; reinforced by workspace-exclude if Antigravity offers a global exclude mechanism):**
- `~/.claude/**` (Claude Code internals + auto-memory; per DPI-A5)
- `~/.ssh/**` (SSH keys + config)
- `~/.aws/**`, `~/.gcp/**`, `~/.azure/**` (cloud credentials)
- `~/.config/gh/**` (GitHub CLI tokens)
- `~/.npmrc` (may contain npm auth tokens)
- `~/.netrc` (may contain HTTP auth)

**Noise-only excludes (not security boundaries; safe but unhelpful to search):**
- `**/node_modules/**`
- `**/dist/**`, `**/build/**`, `**/coverage/**`
- `**/.git/objects/**` (large binary pack files)

**Defensive operator rule (per DPI-WC-2):** Since per-file redaction is unverified, if the operator ever opens an excluded path in Antigravity by mistake (e.g., types `cat .env` in an Antigravity terminal, or expands an excluded path in the file explorer), the operator MUST treat that Antigravity session as **compromised for credential purposes** and revoke/rotate any exposed credential.

---

## §3 — Allowed read-only commands (per DPI-WC-3 + DPI-WC-8 + DPI-WC-10)

**Git read-only inspection (no network operations):**
- `git status`, `git log`, `git diff`, `git ls-files`, `git show <ref>`
- `git blame`
- `git branch` (list only — no `-d`, no `-D`, no `--force`)
- `git tag` (list only — no `-a`, no `-d`)
- `git stash list`, `git stash show` (no `push`, no `pop`, no `drop`, no `clear`)
- `git remote -v` (read-only)
- `git config --list` (read-only inspection)

**Filesystem (read-only inspection):**
- `cat`, `head`, `tail`, `less`, `more`
- `ls`, `ll`, `tree`
- `wc`, `file`, `stat`

**Search:**
- `grep`, `egrep`, `fgrep`
- `rg` (ripgrep), `ag` (the_silver_searcher)
- `find` (read-only; no `-delete`, no `-exec rm`)
- `fzf` (fuzzy find; read-only)

**Language tools (per DPI-WC-8 — syntax inspection only; no project execution):**
- `node --version`
- **`node --check <file.js>`** (syntax-only check; no execution; explicitly allowed per DPI-WC-8)
- `node -e '<small literal expression>'` — restricted to expressions that do NOT import project modules and have NO side effects (e.g., `node -e '1+1'` allowed; `node -e "require('./bot.js')"` forbidden)
- `npm --version`, `npm view <package>` (registry inspection only; no install)
- `npx --no-install <readonly-tool>` (e.g., `npx --no-install prettier --check <file>` — read-only formatting check; any installing form forbidden)
- `which`, `whereis`, `command -v`

**Documentation tools:**
- `man`, `info`
- **Antigravity built-in web browser (per DPI-WC-10): allowed for PUBLIC documentation only.** Permitted domains include Microsoft Learn, Node.js docs, MDN, npm registry pages, OWASP, public RFC text, public blog posts, public GitHub repo READMEs that don't require authentication. **Forbidden** (any form): Discord dashboards, Railway dashboards, GitHub private-repo URLs beyond the two read-only repos' public faces, Kraken account URLs, any URL requiring authentication, any URL leaking session cookies of authenticated services, any URL triggering OAuth/SSO flows.

**Diff / patch viewers:**
- `diff` (compare files)
- `git difftool --tool=<read-only-tool>` (only with read-only difftool configurations)

**Hermetic test invocation (per DPI-WC-3 — empty whitelist by default):**
- **Zero test suites whitelisted at workspace setup time.** Operator may add a specific suite later via an explicit follow-on phase, but the default is no test execution from Antigravity at all.

---

## §4 — Forbidden commands (per DPI-WC-4 + DPI-WC-5 + DPI-WC-10)

Per DPI-WC-4 (high-caution shell-env posture), the forbidden list cannot rely on env restrictions blocking these commands. Enforcement layers: operator-side Antigravity agent-config (disable side-effecting agents), operator discipline, and filesystem permissions where applicable.

**Git (write or network) — all forbidden:**
- `git push`, `git commit` (any form; per DPI-A10)
- **`git fetch`, `git pull`, `git clone`** (per Codex source-design RE-1 + DPI-WC-5 zero-credentials means these would fail anyway)
- `git remote add`, `git remote set-url`, `git remote remove`
- `git branch -d`, `git branch -D`, `git branch --force`
- `git reset --hard`, `git reset --merge`, `git reset --soft` to non-trivial states
- `git rebase` (any form)
- `git cherry-pick`, `git revert`, `git merge`
- `git stash push`, `git stash pop`, `git stash drop`, `git stash clear`
- `git tag -a`, `git tag -d`
- `git config --global ...`, `git config --local ...` (writes)
- `git filter-branch`, `git filter-repo`
- `git submodule add`, `git submodule update --init`

**Package managers:**
- `npm install`, `npm ci`, `npm update`, `npm uninstall`
- `npm publish`, `npm pack`, `npm audit fix`
- `npm run <any-script>` (project scripts may have side effects)
- `yarn install`, `yarn add`, `yarn remove`, `yarn upgrade`, `yarn publish`
- `pnpm install`, `pnpm add`, `pnpm remove`, `pnpm publish`
- `pip install`, `pip uninstall`, `pip-compile`
- `cargo install`, `cargo build` with feature flags that download
- `brew install`, `brew upgrade`, `brew uninstall`
- Any other package install / publish command

**Project code execution (per DPI-WC-8):**
- `node bot.js`, `node dashboard.js`, `node scripts/*.js`, `node src/index.js`
- Any execution of trading code, Relay runtime code, Phase F/G/H drafts, or migrations
- `node -e` expressions that import project modules or have side effects

**Database / storage:**
- `psql` (any form; production or otherwise), `pg_dump`, `pg_restore`
- `sqlite3 <production-or-staging-db-file>`
- `mongo`, `mongosh`, `redis-cli`
- Any DB client targeting any environment

**Deployment / infrastructure:**
- `railway` (any subcommand), `railway login`, `railway up`, `railway deploy`, `railway run`
- `vercel`, `netlify`, `flyctl`, `heroku`
- `aws`, `gcloud`, `az`
- `kubectl`, `helm`
- `terraform`, `pulumi`, `cdktf`
- `docker build`, `docker push`, `docker run` (against any production image)
- `ssh <production-host>`, `rsync` to any remote target

**Discord / Slack / external messaging:**
- `curl https://discord.com/...`, `curl https://discordapp.com/...`
- Any webhook POST to Discord, Slack, Teams, etc.
- Any Discord client CLI tools

**Trading / market APIs:**
- `curl https://api.kraken.com/...`
- Any Kraken CLI tool
- Any other exchange API CLI (Binance, Coinbase, etc.)

**Env / secret manipulation (firm per DPI-WC-4):**
- Any command reading `.env` (`cat .env`, `source .env`, `dotenv`, `direnv reload`, etc.)
- Any command writing to `.env` (`echo ... >> .env`, `dotenv set`, etc.)
- Any command exporting secrets (`export FOO=secret`)
- Any command writing to `~/.ssh/`, `~/.aws/`, `~/.gcp/`, `~/.azure/`, `~/.config/gh/`, `~/.npmrc`, `~/.netrc`
- `gh auth login` (creates authenticated GitHub session in Antigravity-launched shell)

**Memory / Claude Code internals:**
- Any command writing to `~/.claude/projects/*/memory/` (per DPI-A5 + DPI-A9)
- Any command reading from `~/.claude/projects/*/memory/`
- Any command modifying `~/.claude/settings.json` or any Claude Code config

**File system destruction:**
- `rm -rf` (any form against project files)
- `rm` of any file outside `/tmp/`
- `chmod`, `chown` against project files
- `dd` (any form), `truncate`
- `>` redirection to any non-`/tmp/` file

**Process control / daemonization:**
- `kill`, `pkill`, `killall` (against any process not started by Antigravity in this session)
- `nohup`, `disown`, `setsid` (background-daemonize)
- `cron`, `crontab`, `launchctl` (macOS launchd), `systemctl` (Linux systemd) — any scheduler / daemon install

**Network:**
- Any `curl` or `wget` to non-public-docs URLs (per DPI-WC-10)
- `nc`, `ncat`, `netcat` (any form), `nmap`
- `ssh` to any host, `scp`, `sftp`, `ftp`
- DNS / hosts-file mutation

**Other:**
- `sudo` (any form), `su` (any form)
- Any installer (`.dmg`, `.pkg`, `.deb`, `.rpm`, `.msi`)
- Any system update command

**Antigravity built-in web browser — forbidden URLs (per DPI-WC-10):**
- `https://discord.com/*` (beyond public documentation pages that don't leak session)
- `https://railway.app/*` (any dashboard / project URL)
- `https://github.com/relentlessvic/*` beyond the two allowed repos' public faces; never `/settings/`, never `/keys/`, never any URL requiring `repo:write` auth
- Any `https://api.kraken.com/*` URL
- Any URL that triggers OAuth / SSO flows
- Any URL of any internal/private operator service

---

## §5 — No-secret rules (per DPI-WC-4)

1. **No `.env` access** at any layer (workspace exclude + forbidden CLI; cannot rely on shell-env restriction per DPI-WC-4).
2. **No GitHub credentials in Antigravity** (per DPI-WC-5: zero git credentials; no `gh auth`; no SSH key with push privileges; no GitHub PAT).
3. **No Railway / Discord / Kraken / Anthropic / OpenAI / Google / DB tokens** in Antigravity context.
4. **No memory-file content** (`~/.claude/projects/*/memory/` excluded per DPI-A5).
5. **No manual live-armed flag literal exposure** in Antigravity-drafted text (descriptive use of "manual live-armed flag" allowed; the all-caps env-var literal form forbidden per established Phase D/E/F/ANTIGRAVITY-MIGRATION convention).
6. **No paste of secret material into Antigravity chat / scratch buffers.** Operator-discipline rule: even if Antigravity's UI offers it, never paste a token, password, API key, or .env line into any Antigravity-side input.
7. **Antigravity's own credentials** (Google account, Antigravity API key for AI provider) are managed inside Antigravity; they are NOT Agent Avila credentials and never get shared with project tools.
8. **(Per DPI-WC-2 defensive rule)** If the operator accidentally opens an excluded path in Antigravity, treat the session as compromised for that credential and rotate.

---

## §6 — No-commit / no-push rules (per DPI-WC-5)

**Three layers of enforcement (defense in depth):**

**Layer 1 — Forbidden commands (§4):** `git push`, `git commit`, `git fetch`, `git pull`, `git clone`, etc. all forbidden.

**Layer 2 — Zero git credentials in Antigravity (per DPI-WC-5):**
- No SSH key (no read-only deploy key, no push key)
- No GitHub PAT (no `repo:read`, no `repo:write`, none at all)
- No `gh auth` session (`gh auth status` returns "not authenticated" from Antigravity-launched shells)
- No HTTPS basic-auth in `~/.netrc`
- **Network git operations are physically impossible** because Antigravity has no credential to authenticate against `github.com`
- Antigravity reads the local working trees that Claude Code maintains; updates flow when operator runs `git fetch` / `git pull` in the Claude Code session

**Layer 3 — Workflow discipline:**
- All commits + pushes happen in the canonical Claude Code session per parent design §8 + §13
- Operator never invokes git stage/commit/push from Antigravity-launched terminal panes
- Even if Layers 1 + 2 were misconfigured, Layer 3 is the operator's habit boundary

---

## §7 — Draft-return workflow (per DPI-WC-6 + DPI-WC-7)

**Two transfer mechanisms (per DPI-WC-6 — method C off-table):**

**Method A — Copy-paste (preferred for small drafts):**
- Operator selects Antigravity-side draft text → copies → pastes into the canonical Claude Code chat input or into a Claude-Code-tool-created file.
- Best for: design proposals, RE responses, scratch notes, single-file drafts < ~500 lines.

**Method B — Scratch file via `/tmp/`:**
- Antigravity writes draft to `/tmp/<phase>-<artifact>.<ext>` (e.g., `/tmp/g-gateway-design-notes.md`, `/tmp/phase-g-draft-connect.js`).
- Claude Code reads from `/tmp/` to stage canonical placement.
- Best for: multi-file code drafts, large design docs, anything > ~500 lines.
- Established precedent: Phase D operator-manual workflow used `/tmp/store-*.js` for this exact pattern.

**Method C (branch-based) — OFF-TABLE per DPI-WC-6.** Excluded from this design. Antigravity does NOT write to tracked branches. Consistent with §4 forbidden `>` redirection outside `/tmp/`.

**Common rule (both methods):**
- After transfer to Claude Code, the operator must explicitly state in the Claude Code chat: "Drafted in Antigravity; please review per §8 Codex review path." This explicit handoff statement triggers the review pipeline.

**Transfer-log mandate (per DPI-WC-7):**

Future codifications of any phase that consumed Antigravity-drafted material MUST include a **transfer-log section** in the resulting handoff record, structured as:

```
## §N — Antigravity transfer log

| Date | Antigravity session | Artifact | Transfer method | Codex review verdict | Phase landed |
|---|---|---|---|---|---|
| 2026-MM-DD | <session-id-or-description> | `/tmp/<file>` or paste-context | A or B | round-N PASS | <phase-name> at <SHA> |
```

- This transfer-log section is required for every future handoff in either repo that includes Antigravity-originated content.
- The codification phase (`ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC`) codifies this transfer-log template as the canonical pattern.
- Handoffs that contain NO Antigravity-originated content do not require a transfer-log section.

---

## §8 — Codex review path for Antigravity-generated work (per DPI-A8 + parent design §8)

**Mandatory review pipeline (same per-phase Codex cadence as Phases C/D/E):**

1. **Operator carries draft to Claude Code session** via §7 method A or B.
2. **Claude Code stages the draft** as a candidate file (in working tree or `/tmp/`).
3. **Operator dispatches Codex review** using the established `codex:codex-rescue` subagent (same dispatch mechanism Phases C/D/E used for on-disk source review).
4. **Codex returns** one of: PASS / PASS WITH REQUIRED EDITS / FAIL.
5. **If PASS WITH REQUIRED EDITS:** apply RE conversation-only (or via Claude Code Edit tool), dispatch Codex narrow round-2 re-review until PASS.
6. **(Optional, per memory's 3-brains rule)** Gemini long-context UX review; ChatGPT fallback if Gemini quota fails.
7. **Operator approves staging + commit + push** from the canonical Claude Code session only.
8. **Push goes via Claude Code session.**

**Review-pipeline characteristics:**
- Same per-phase cadence as Phases C/D/E (round-1 → apply RE → round-2 → PASS).
- Codex thread management stays in Claude Code session — operator chooses continue vs new thread per established pattern.
- Codex's PASS verdict does NOT constitute operator approval; only Victor's in-session chat instruction in the canonical Claude Code session grants approval.

**Code-type-specific notes:**
- **Future Phase F module drafts:** review against `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-DESIGN.md` (439-line canonical design).
- **Future Phase G module drafts:** require §15 extension to be landed first (if production-send-failure halt class is needed), then review against the Phase G design (not yet drafted).
- **Future Phase H module drafts:** Docker / Railway / CI scoped; review against future Phase H design (not yet drafted).
- **Tests:** even if drafted in Antigravity, tests inherit the trading-runtime boundary — they must NOT touch DB, Discord, Railway, Kraken, network, or production state.
- **Design proposals (Mode 2 conversation):** less formal; round-1 PASS often sufficient.
- **Docs codifications (Mode 3 DOCS-ONLY):** standard Codex DOCS-ONLY review pipeline as used for D-STORE-DESIGN-SPEC, E-VERIFY-DESIGN-SPEC, F-HALT-DESIGN-SPEC, ANTIGRAVITY-MIGRATION-DESIGN-SPEC.

**No-bypass rule (firm):**
- No code drafted in Antigravity may reach `origin/main` (either repo) without passing through this review pipeline.
- No exception for "small fixes," "typo-only changes," "doc-only changes," or any other category. ALL code goes through the pipeline.

---

## §9 — Safety boundaries / anti-features (per DPI-WC-9 carve-out)

This `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC` codification phase MUST:

- NOT install Antigravity (operator-manual install only; this design records recommendations).
- NOT configure any Antigravity workspace (operator-manual setup only; this design records the design that future setup would follow).
- **NOT create or modify any `ANTIGRAVITY-RULES.md` file (per DPI-WC-9 — deferred to a separate future phase `ANTIGRAVITY-RULES-DESIGN`).**
- NOT modify ARC-1 through ARC-7.
- NOT change any safety-policy doc or canonical Relay handoff record beyond this phase's own scope.
- NOT modify the trading runtime (`bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`).
- NOT touch Relay or external Hermes Agent.
- NOT change orchestrator authority (Victor remains sole approver; Claude Code remains canonical session for approvals + commits + pushes + RED-tier).
- NOT introduce any new approval surface, scheduler, webhook, MCP server, cron, or background automation in Antigravity.
- NOT activate Autopilot Loop B/C/D.
- NOT advance the phase-loop counter.
- NOT break CEILING-PAUSE.
- NOT grant Antigravity any secret, credential, push capability, or RED-tier authority.
- NOT install any system daemon, launchd / systemd service, or persistent background process for Antigravity.

This DOCS-ONLY codification phase produces 4 parent-repo file changes only (1 new SAFE-class handoff record + 3 status doc updates). No Relay-repo touch. No Antigravity install. No workspace configuration.

---

## §10 — Surface authority matrix (Option B baked in; workspace-config-tightened)

| Surface | Read trees | Draft code | Draft docs | Exec read-only CLI | Edit `bot.js` etc. | Stage/commit `main` | Push `origin/main` | Railway/Discord/DB/Kraken | Approve | Auto-memory R/W | Git credentials |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Victor (operator) | ✓ | ✓ | ✓ | ✓ | ✓ (sole) | ✓ | ✓ | ✓ (sole) | ✓ (sole) | n/a | ✓ |
| Claude Code (canonical) | ✓ | ✓ (with approval) | ✓ (with approval) | ✓ (with approval) | ✗ (without explicit approval) | ✓ (with approval) | ✓ (with approval) | ✗ (without explicit approval) | ✗ | ✓ | ✓ (operator's) |
| **Antigravity** | ✓ | ✓ (scratch / local only) | ✓ (scratch / local only) | ✓ (read-only subset only per §3) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✗ (zero per DPI-WC-5)** |
| Codex | ✓ (review only) | ✗ | ✗ | ✓ (read-only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Gemini / ChatGPT | ✓ (review only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

The Antigravity row is now tightest among non-Victor surfaces: it has zero git credentials (column 12) and zero auto-memory access (column 11), and is restricted to a read-only command subset.

---

## §11 — Risk register (DPI applied)

| Risk | Likelihood (with DPI applied) | Severity | Mitigation |
|---|---|---|---|
| Operator opens `.env` in Antigravity by mistake | LOW-MED (workspace-level exclude per DPI-WC-2) | HIGH | §2 firm exclude; DPI-WC-2 defensive rule: treat session as compromised + rotate |
| Antigravity background agent runs forbidden command | LOW (after §4 + agent-config disable + DPI-WC-5) | HIGH | §4 forbidden list; agent-config blocks side-effecting CLI; no credentials means network ops fail |
| Drafted code reaches canonical repo without Codex review | LOW | HIGH | §8 mandatory pipeline; no-bypass rule; operator discipline |
| Antigravity-side agent attempts `git push` | LOW (would fail anyway per DPI-WC-5) | LOW (fails physically) | DPI-WC-5 zero credentials; §4 forbidden; §6 layer-2 |
| Operator-installed Antigravity extension introduces new approval surface | LOW-MED | HIGH | §9 prohibition; operator reviews extensions before install |
| Memory-file path bleed via filesystem traversal | LOW | MED | §2 exclude `~/.claude/**`; §4 forbids writes there |
| Antigravity backend retains snippets of repo code | MED | MED (depends on data handling) | Operator-side: review Antigravity data retention / training opt-out; never paste secret material |
| Antigravity-drafted test triggers DB or network call | LOW (no whitelisted suite per DPI-WC-3) | HIGH if it happens | §3 empty whitelist; §4 forbids project execution; operator whitelist required for any test |
| Operator confuses Antigravity UI "approved" affordance with operator approval | MED | HIGH | Parent design §3 + this design §6; reinforce in handoff |
| Confusion: which repo am I editing (working tree shared with Claude Code) | MED | LOW | Operator discipline; multi-root workspace; future `ANTIGRAVITY-RULES.md` per DPI-WC-9 (separate phase) |
| Inherited shell env exposes sensitive paths (per DPI-WC-4) | MED | HIGH | High-caution posture; §2 + §4 enforce at file/command level; no reliance on env restriction |
| Antigravity built-in browser navigates to authenticated URL (per DPI-WC-10) | LOW-MED | MED | §4 forbidden URLs; operator discipline; no auto-login configured |

---

## §12 — Codex review history

- **Round-1 DESIGN-ONLY:** **Overall PASS** across all 13 narrow goals (read-only repos, complete exclusions, no-secret access, read-only commands, comprehensive forbidden list, zero-credentials posture, copy-paste/`/tmp/` only transfer, method C off-table, transfer-log mandate clear, mandatory Codex review, no install/config authorization, Relay+Autopilot DORMANT, approvers `{Victor}` preserved) plus sentence-level forbidden-content checks (no manual live-armed flag literal in new text; no tokens/env values/Kraken/DB/Railway data fragments; no position.json content; no approval-like RED-tier language; no install/config promotion). **No required edits issued.**

Codex round-2 re-review not required because round-1 returned overall PASS with no RE.

---

## §13 — Non-authorization preservation clauses

This DESIGN-SPEC codification phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

- Installing Google Antigravity IDE (operator-manual install only; separately gated future operator decision)
- Configuring any Antigravity workspace (separately gated future operator decision after install)
- Giving Antigravity any credential (firm zero-credential posture per DPI-WC-5: no GitHub PAT, no SSH key, no `gh auth`, no `~/.netrc` HTTPS basic-auth)
- Creating or modifying any `ANTIGRAVITY-RULES.md` file (deferred to separate future phase `ANTIGRAVITY-RULES-DESIGN` per DPI-WC-9)
- Whitelisting any test suite for Antigravity execution (per DPI-WC-3 empty default; operator must add via explicit follow-on phase)
- Any Antigravity-side commit, push, deploy, Discord activity, Railway activity, DB connection, Kraken API call, trading code execution, Relay activation, Autopilot activation, or external Hermes Agent integration
- Modification of ARC-1 through ARC-7
- Advancing the phase-loop counter
- Breaking CEILING-PAUSE
- Modifying the trading runtime
- Modifying orchestrator authority
- Posting to Discord
- Reading `.env` from Antigravity
- Reading auto-memory at `~/.claude/projects/.../memory/` from Antigravity
- Running `git push`, `git fetch`, `git pull`, `git clone`, `npm install`, `node bot.js`, `psql`, or `railway` from Antigravity
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED)
- Stage 7 dry-run execution; Stages 8 / 9 / 10a / 10b auto-publish
- DASH-6 / D-5.12f / Migration 009+
- Memory-file edit; test-suite edit
- Modification of any other safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file
- Phase F SAFE IMPLEMENTATION (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT`) or any subsequent Relay-runtime lettered phase

**Codex round-1 PASS verdict does NOT constitute operator approval.** Per `ROLE-HIERARCHY.md` and `CLAUDE.md`: Codex / Claude / Gemini / ChatGPT / Antigravity-hosted agents cannot self-approve. Only Victor's in-session chat instruction in the canonical Claude Code session grants approval. The set of approvers stays exactly `{Victor}`.

**Preservation invariants:**
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- Phase A CLOSED at Relay-repo `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf` preserved
- Phase A closeout CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026` preserved
- B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b` preserved
- Phase B CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb` preserved
- Phase B closeout CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` preserved
- C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9` preserved
- Phase C CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` preserved
- Phase C closeout CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b` preserved
- D-STORE-DESIGN-SPEC CLOSED at parent-repo `1625f13f62df565bb52705e0106769624d061dd0` preserved
- Phase D CLOSED at Relay-repo `0d0210a32d9341d09bb7bed9be93d17c58791fbe` preserved
- Phase D closeout CLOSED at parent-repo `0314d2c0df50b67292a1f219a8d8fcc26f693655` preserved
- §15-EXTENSION-FOR-PHASE-E CLOSED at parent-repo `c3b3fbcc107d00022beae87ff238b43e351d282c` preserved (canonical RUNTIME-DESIGN §15 Layer 4 IDs 29/30/31/32)
- E-VERIFY-DESIGN-SPEC CLOSED at parent-repo `a7a1f7aaaa1de961b6338af900dc27c5b1c4a2f6` preserved
- Phase E CLOSED at Relay-repo `21896d65132a1dc9d48f2f5563113c06f62d0893` preserved
- E-VERIFY-CLOSEOUT CLOSED at parent-repo `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` preserved
- F-HALT-DESIGN-SPEC CLOSED at parent-repo `02edc238790c016fb5c36bc7b0fbdd563fa030f7` preserved
- ANTIGRAVITY-MIGRATION-DESIGN-SPEC CLOSED at parent-repo `71af035f9a1f7489bfd663e099a15fda7439d0a7` preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Approvers exactly `{Victor}` preserved
- `position.json.snap.20260502T020154Z` carve-out preserved untracked

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or modify the Relay runtime, does NOT install Antigravity, does NOT configure any workspace, does NOT post to Discord, and does NOT execute any production action.

---

## §14 — Next steps (post-DESIGN-SPEC)

1. Operator approves the persisted DESIGN-SPEC (this file) via operator-manual commit + push of the 4-file scope from the canonical Claude Code session.
2. (Optional, per memory's 3-brains rule) Gemini long-context UX review of the codified design; ChatGPT fallback if Gemini quota fails. (Note: this is a security/governance design, not UI work — the 3-brains memory's "read-only UI work" caveat does NOT apply; full Gemini review is appropriate.)
3. (Future, separately gated, operator-manual) Operator installs Google Antigravity if they choose; this design records recommendations but does NOT authorize the install.
4. (Future, separately gated, operator-manual) Operator configures the Antigravity workspace following the codified DESIGN-SPEC. Records the as-built workspace configuration via `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG` execution phase (operator-manual phase mode; recorded in status docs after the fact).
5. (Future, separately gated) Operator opens `ANTIGRAVITY-RULES-DESIGN` per DPI-WC-9 if they want an in-repo rules-reminder file for Antigravity-hosted agents.
6. (Ongoing) For any code drafted in Antigravity that operator intends to bring into either repo, follow §8 review rule (Codex on-disk review in Claude Code session before any canonical placement).
7. (Ongoing) All approvals, commits, pushes, RED-tier actions continue to route through the canonical Claude Code session per parent design §3 and this design's §6 + §10.

Each step above requires its own operator decision. This DESIGN-SPEC codification phase authorizes none of them.

---

**End of canonical ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN record. Future Antigravity install + workspace configuration remain separately gated and are NOT authorized by this DOCS-ONLY codification phase.**
