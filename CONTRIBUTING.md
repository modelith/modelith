# Contributing to Modelith

English | [日本語](CONTRIBUTING.ja.md)

## License and CLA

- Modelith is provided under [AGPL-3.0](LICENSE) with the [Plugin Exception](PLUGIN-EXCEPTION.md).
- Your first pull request needs your **agreement to the CLA (Contributor License Agreement)**.
  Follow the instructions when they appear on the pull request. (The CLA text and the signing process are being prepared; see ADR-0006.)

## How development works

- Branching strategy: [docs/development/branching-strategy.md](docs/development/branching-strategy.md)
- Design decisions: [docs/adr/](docs/adr/)
- Before you finish, make sure `scripts/check.sh` is green. CI runs the same script.

Most developer documents are in Japanese. Issues and pull requests in English are welcome.

## Tools you need

- Rust stable (`rust-toolchain.toml` installs it together with the wasm32 target)
- The latest Node.js 26 (`.nvmrc`; CI uses the latest 26.x every time)

## Running it locally

You need Rust (stable; `rust-toolchain.toml` installs the wasm32 target), Node.js 26, and Docker if you run the UI tests.

```bash
git clone https://github.com/modelith/modelith.git
cd modelith
npm ci --prefix web
scripts/build-wasm.sh          # build the Rust core as wasm (needed before the web app)
npm run dev --prefix web       # open http://localhost:5173/
```

```bash
scripts/check.sh               # static checks → unit → integration → system (same as CI; always pass it before a PR)
scripts/check.sh --fast        # static checks and unit tests only
```

## Adding and updating dependencies

These rules protect against supply-chain attacks (malicious versions published from hijacked packages).

- Commit the lockfiles (`Cargo.lock`, `package-lock.json`). Install npm dependencies with `npm ci` (use `npm install` only when changing dependencies).
- Do not run install scripts (`postinstall` and so on). Put `ignore-scripts=true` in the `.npmrc` next to each lockfile; CI also installs with `npm ci --ignore-scripts`.
- Do not take versions published less than 7 days ago (Dependabot's `cooldown` is also 7 days), except for urgent security fixes.
- Keep rustup itself up to date (`rustup self update`; CI updates it before installing the toolchain and checks for 1.29.2 or later).
- Do not depend on Python packages.
- CI's `audit` job checks for known vulnerabilities (RustSec, npm) and npm signatures and provenance (`npm audit signatures`).

## Layout

```
crates/modelith-core   Rust core (the SysML v2 parser, shared by the browser, CLI and server)
crates/modelith-wasm   wasm for the browser
crates/modelith-cli    the modelith command (in preparation)
web/                   web app (TypeScript + Vite)
docs/                  documents (requirements, design decisions, development procedures)
```

## Documents for developers (in Japanese)

| Document | Contents |
| --- | --- |
| [Requirements](docs/reference/requirements.sysml) | What to build. The single source of truth, written in SysML v2 |
| [Design decisions (ADR)](docs/adr/) | Why it is built that way |
| [Architecture](docs/explanation/architecture.md) | The overall structure and the stages ahead |
| [Branching strategy](docs/development/branching-strategy.md), [testing](docs/development/testing.md), [release procedure](docs/development/releasing.md) | How development proceeds |
| [UI writing guide](docs/development/ui-writing.md) | How to write the words on screen |
| [CLAUDE.md](CLAUDE.md) | Working guide for AI agents |
