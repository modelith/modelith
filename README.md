<p align="center">
  <img src="https://raw.githubusercontent.com/modelith/.github/main/profile/logo.svg" width="88" height="88" alt="Modelith">
</p>

<h1 align="center">Modelith</h1>

<p align="center">
  <b>An open-source SysML v2 modeling editor with synchronized text and diagram editing</b><br>
  <sub>テキストと図を同期して編集できる、オープンソースの SysML v2 モデリングエディタ</sub>
</p>

<p align="center">
  <a href="README.ja.md">日本語</a> &nbsp;|&nbsp;
  <a href="https://modelith.github.io/modelith/"><b>Try it in your browser</b></a> &nbsp;|&nbsp;
  <a href="https://modelith.github.io/">User manual</a> &nbsp;|&nbsp;
  <a href="https://github.com/modelith/modelith/releases">Releases</a> &nbsp;|&nbsp;
  <a href="https://modelith.github.io/modelith/reports/requirements.html">Test results</a> &nbsp;|&nbsp;
  <a href="https://github.com/modelith/modelith/issues/new/choose">Feedback</a> &nbsp;|&nbsp;
  <a href="https://github.com/sponsors/modelith">Sponsor</a>
</p>

<p align="center">
  <a href="https://github.com/modelith/modelith/releases"><img src="https://img.shields.io/github/v/release/modelith/modelith?include_prereleases&label=release" alt="release"></a>
  <a href="https://github.com/modelith/modelith/actions/workflows/ci.yml?query=branch%3Adev"><img src="https://github.com/modelith/modelith/actions/workflows/ci.yml/badge.svg?branch=dev" alt="CI"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Plugin%20Exception-blue" alt="license"></a>
</p>

<p align="center">
  <a href="https://modelith.github.io/modelith/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/modelith/.github/main/profile/screenshot-dark.png">
      <img src="https://raw.githubusercontent.com/modelith/.github/main/profile/screenshot.png" width="800" alt="The Modelith window: files on the left, a traceability diagram in the middle, and SysML v2 text on the right">
    </picture>
  </a>
</p>

## What is Modelith?

A SysML v2 modeling editor for systems engineers, students and researchers.
A model you write as text becomes a diagram right away, and what you change in the diagram is written back to the text.

- **Write it or draw it — it's the same model.** Type text and the diagram follows; add elements and relationships in the diagram and the text is rewritten.
- **Diagrams for each purpose.** Show the same model from the angle you need: block definition, internal block, activity, state machine, sequence, traceability and more. Export them as SVG or draw.io.
- **Spot gaps in your requirements.** Follow the chain from stakeholder needs through architecture to verification, and see where derivation, satisfaction or verification is missing.
- **Readable without knowing SysML v2.** Hover over a keyword in the text or the name of a diagram to see what it means.
- **Just open a browser.** No installation and no account. Open a local folder like in VS Code, then edit and save.
- **Your model stays with you.** Modelith does not send your model anywhere and uses no analytics. A model is plain text, so you can track changes with Git.

## Getting started

Open **<https://modelith.github.io/modelith/>** in your browser to see a sample model (an electric kettle). See the [user manual](https://modelith.github.io/) (in Japanese) for how to use it.

Modelith is published in three channels. Each keeps its own last session, drafts and settings.

| Channel | URL | What it has |
| --- | --- | --- |
| Stable | <https://modelith.github.io/modelith/> | The latest release |
| Release candidate | <https://modelith.github.io/modelith/rc/> | The latest release candidate, while one is out |
| Preview | <https://modelith.github.io/modelith/preview/> | The latest alpha or beta of the next version, with features still in development |

| Environment | What you can do |
| --- | --- |
| Chrome, Edge | Open a folder, edit its files directly and save over them |
| Safari, Firefox | Load files, and save by downloading |
| Phones and other narrow screens | View and check models (text opens read-only; tap "編集" (Edit) to change it) |

The app's screens are in Japanese for now. An English version is planned for 0.4.0.

## SysML v2 support

Modelith supports the commonly used parts of the SysML v2 textual notation, and draws them in the diagrams people use most.

- **Notation:** packages and `import`, definitions and usages (`part`, `item`, `attribute`, `port`, `enum`, `occurrence` and more), connections, interfaces and flows, actions, states and transitions, requirements, `satisfy`, `verify` and derivation, use cases, views with `expose` and `filter`, comments and metadata. From 0.2.0, a model can span several files in a folder.
- **Diagrams:** block definition / general diagram, internal block diagram, activity diagram, state machine diagram, sequence diagram, and traceability. Export as SVG or draw.io.
- **Not yet:** expressions are kept as text and not evaluated; KerML, the standard library, and the model interchange format (`.kpar`) are not supported yet. Anything Modelith cannot read yet is reported in the problem list, not dropped silently.

The remaining notation is planned in this order (the [conformance table](docs/reference/sysml-conformance.md), in Japanese, has the status of each notation).

| Version | Notation |
| --- | --- |
| 0.3.0 | Filtered `import Q::*[@F]`, `filter @X;` directly in a package, `doc` and `comment` in relationship bodies, multiple types `: A, B`, enum values with values, and the syntax of expressions (values with units `1500 [kg]`, expressions with bodies `->collect{ … }`) without evaluating them |
| 0.4.0 | KerML (declarations such as `classifier`, `struct` and `function`; reading `.kerml` files) |
| 0.5.0 and later | Evaluating expressions and units, bundling the standard library, the geometry, grid and browser views, the remaining parts of the sequence and state machine diagrams, and the model interchange format (`.kpar`) |

The plan may change based on user feedback. If you need a notation, please let us know in [Issues](https://github.com/modelith/modelith/issues/new/choose).

## Roadmap

**0.1.0** is the first stable version. **0.2.0** is in release candidates; try it in the release candidate channel.

| Version | What you can do |
| --- | --- |
| 0.1.0 | Write text and draw diagrams of the same model; requirement traceability; export; plugins for check rules |
| 0.2.0 | Create diagrams and edit more on screen without writing text; adjust lines; better export; fill the gaps in requirement, block definition, internal block and activity diagrams; models spanning several files |
| 0.3.0 | AI (Claude, Codex and others) reads, checks and edits your local models and exports diagrams through MCP; more SysML v2 notation |
| 0.4.0 | AI edits show up in the open app and can be undone; KerML; English screens and manual |
| 0.5.0 | Keep projects on a server you run yourself and open them from any computer |
| 0.6.0 – 0.8.0 | Share projects with others, edit together at the same time, and keep editing offline |

See the [release plan](docs/development/release-plan.md) and the [plan from 0.3.0](docs/development/release-plan-0.3.0.md) (in Japanese) for details, and [Releases](https://github.com/modelith/modelith/releases) for the changes in each version.

## Documentation

| Document | Contents |
| --- | --- |
| [User manual](https://modelith.github.io/) (Japanese) | How to use it: the screen, files, diagrams, an introduction to SysML v2 notation, plugins |
| [SysML v2 conformance table](docs/reference/sysml-conformance.md) (Japanese) | Support status for each notation in the specification |
| [Check rules](docs/reference/check-rules.md) and [script plugins](docs/reference/script-plugins.md) (Japanese) | How to build plugins |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to take part in development: running it locally, the layout, documents for developers |
| [SECURITY.md](SECURITY.md) | How to report a security issue privately |

## Contributing

Please send your impressions and requests such as "I'd like this kind of diagram" to [Issues](https://github.com/modelith/modelith/issues/new/choose). Issues in English or Japanese are welcome.
Before contributing code, please read [CONTRIBUTING.md](CONTRIBUTING.md) (including the CLA).

| Repository | Contents | License |
| --- | --- | --- |
| [modelith](https://github.com/modelith/modelith) | The editor (Rust core, web app, CLI) | AGPL-3.0 + [Plugin Exception](PLUGIN-EXCEPTION.md) |
| [plugin-sdk](https://github.com/modelith/plugin-sdk) | Interfaces and type definitions for plugins | MIT |
| [modelith.github.io](https://github.com/modelith/modelith.github.io) | User manual | MIT |

## Sponsor

We accept support for continuing Modelith's development through [GitHub Sponsors](https://github.com/sponsors/modelith).
With a GitHub account, you can choose a monthly or one-time sponsorship.

<a href="https://github.com/sponsors/modelith"><img src="https://img.shields.io/badge/sponsor-modelith-ea4aaa?logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub Sponsors"></a>

### Sponsors

These are the people and organizations supporting Modelith. Sponsors on a plan of $10 or more a month are listed here. Please let us know if you would rather not be listed.

<!-- Corporate sponsors ($100 a month): logo and link -->

<!-- Supporters ($10 a month): GitHub account -->

## License

Copyright (C) 2026 The Modelith Authors

[AGPL-3.0](LICENSE) with the [Modelith Plugin Exception](PLUGIN-EXCEPTION.md).
This program is distributed WITHOUT ANY WARRANTY; see the license for details.
"The Modelith Authors" are the contributors recorded in this repository's Git history.
Third-party components bundled with the web app (fonts, Vite's runtime code, and the Rust crates compiled into the WebAssembly core) are listed with their licenses in `licenses.txt` of each build.
Plugin interfaces ([plugin-sdk](https://github.com/modelith/plugin-sdk)) are MIT licensed.

## Trademarks

SysML® and OMG® are registered trademarks, and KerML™ is a trademark, of Object Management Group, Inc.
Modelith is an independent project. It is not affiliated with or endorsed by OMG.
Modelith is based on the SysML v2 and KerML specifications, but does not claim conformance with them
(see [docs/reference/sysml-conformance.md](docs/reference/sysml-conformance.md) for what is supported).
