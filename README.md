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

To try features still in development, use the prerelease (alpha / beta) at **<https://modelith.github.io/modelith/preview/>**.
The prerelease keeps its own last session, drafts and settings, separate from the stable version above.

| Environment | What you can do |
| --- | --- |
| Chrome, Edge | Open a folder, edit its files directly and save over them |
| Safari, Firefox | Load files, and save by downloading |
| Phones and other narrow screens | View and check models (text opens read-only; tap "編集" (Edit) to change it) |

The app's screens are in Japanese for now.

## SysML v2 support

Modelith supports the most used parts of the SysML v2 textual notation first (**as of 0.2.0-alpha.3**, checked against the [SysML v2 specification](https://github.com/Systems-Modeling/SysML-v2-Release) on 2026-10-23).

Status is "Supported" (works), "Partial" (something is missing) or "Not yet" (cannot be used yet).

| Area | Notation | Status | What is missing | Planned |
| --- | --- | --- | --- | --- |
| Packages | `package` (including nesting), `library package` | Supported | The library marker is not recorded | — |
| | `import` (`P::A`, `P::*`, `P::**`), visibility `private`, `public`, `protected` | Supported | With a folder open, names from other files in the folder can be used too. A diagram draws only the definitions from other files that the shown file refers to, labeled with the file name | — |
| | `filter` directly in a package, filtered import `import P::*[@F]` | Not yet | | 0.2.0 |
| Names | Quoted names `'Fuel Tank'`, short names `<R1>`, qualified names `A::B`, `alias` | Partial | An `alias` written in another file is not resolved | 0.2.0 |
| Structure | Definitions and usages of `part`, `item`, `attribute`, `port`, `enum`, `occurrence`; `event occurrence`, `timeslice`, `snapshot`, `individual` | Supported | | |
| | Typing `:`, specialization `:>`, redefinition `:>>`, reference `::>`, multiplicity `[0..4]`, values `=`, `:=`, `default`, direction `in`, `out` | Supported | `: A, B` uses only the first type | — |
| | Features without a keyword `x : Real;`, `ref r;`, crossing `=>`, `crosses`, conjugated ports `~Pt` | Supported | | |
| Connections | `connection`, `connect` (including forms joining three or more ends), `interface` (including the form without `connect`), `bind`, `allocate`, `dependency` | Supported | | |
| | `flow`, `flow def`, `message`, `succession flow` (including the short form without `from`) | Supported | | |
| Behavior | `action`, sequencing `first … then`, `fork`, `join`, `merge`, `decide`, `send`, `accept`, `assign`, `terminate`, `if`, `while`, `for` | Supported | Action parameters and the flows between them are not drawn | 0.2.0 |
| | `state`, `transition` (trigger, guard, effect and the short forms), `entry`, `do`, `exit`, `parallel` | Supported | Transitions inside a state usage are not drawn | 0.3.0 or later |
| | `perform`, `exhibit` (including `perform x.y;` and `exhibit s;` pointing at existing elements), `calc`, `constraint` | Supported | | |
| Requirements and verification | `requirement`, `subject`, `stakeholder`, `actor`, `concern`, `case`, `analysis`, `verification`, `use case`, `#derivation dependency` | Supported | | |
| | `satisfy` (including the form without `by` and the declaring form), `frame` | Supported | | |
| | `verify` | Partial | No line is drawn inside an untyped verification usage | — |
| | `objective`, `assert constraint`, `assert not` | Supported | Objectives go in the compartment of the verification or analysis, and constraints in the owner's compartment. Expressions are not evaluated | — |
| Diagrams (views) | `view`, `view def`, `expose`, `filter` (expressions with `and`, `or`, `not` and so on), `render` | Partial | A `filter` that compares metadata values, and table or text `render`, cannot be used | 0.3.0 or later |
| Annotations | `doc`, `comment … about` (notes), `rep`, `metadata def`, `#M`, `metadata … about`, user-defined keywords | Supported | A `doc` in the body of a relationship (`dependency`, `alias`) is not recorded | — |
| Expressions | Expressions, units `1500 [kg]`, `->collect{ … }` | Partial | Kept as text only, not evaluated | 0.3.0 or later |
| Other | KerML, the standard library, the model interchange format (`.kpar`) | Not yet | KerML declarations are reported as "not supported yet" | 0.3.0 or later |

| Diagram type (SysML v2 standard view) | Status | What is missing | Planned |
| --- | --- | --- | --- |
| Block definition / general diagram (GeneralView) | Partial | No ellipse for use cases and no actor symbol | 0.3.0 or later |
| Internal block diagram (InterconnectionView) | Partial | No way to draw a new line from the diagram to a port of the subject itself (on the frame); write it as text | 0.3.0 or later |
| Activity diagram (ActionFlowView) | Supported | | — |
| State machine diagram (StateTransitionView) | Partial | Transitions inside a state usage and any state definition after the first are not drawn | 0.3.0 or later |
| Sequence diagram (SequenceView) | Partial | No frames for alternatives or loops (`alt`, `loop`), and events or ordering cannot be added from the diagram | 0.3.0 or later |
| Geometry, grid and browser views (GeometryView, GridView, BrowserView) | Not yet | Drawn as a general diagram instead, with a notice | 0.3.0 or later |

The [conformance table](docs/reference/sysml-conformance.md) (in Japanese) has the details for each notation. The plan may change based on user feedback. If you need a notation, please let us know in [Issues](https://github.com/modelith/modelith/issues/new/choose).

## Roadmap

Modelith is now in **beta toward 0.1.0**. Features are frozen, and until 0.1.0 only bugs are fixed. It grows with feedback from test users, so please tell us about anything that behaves unexpectedly.

| Version | Contents |
| --- | --- |
| 0.1.0 | First stable release |
| 0.2.0 | Creating diagrams, editing on screen, adjusting lines and better export; filling the gaps in requirement, block definition, internal block and activity diagrams. `import` and models spanning several files depending on progress |
| 0.3.0 and later | Expression evaluation and units, KerML, the standard library, the remaining diagrams, and the model interchange format |

See the [release plan](docs/development/release-plan.md) (in Japanese) for details, and [Releases](https://github.com/modelith/modelith/releases) for the changes in each version.
After 0.1.0, Modelith will grow toward a CLI, MCP, LSP, plugins and a server ([architecture](docs/explanation/architecture.md), in Japanese).

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
