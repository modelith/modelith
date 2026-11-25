# modelith-cli

Command line tools for [Modelith](https://github.com/modelith/modelith), an open-source SysML v2 modeling editor
with synchronized text and diagram editing.

- `modelith mcp <project folder>` starts an [MCP](https://modelcontextprotocol.io/) server, so that AI clients such as
  Claude Code or Codex can read, check and change the SysML v2 model in a folder on your computer.
- `modelith export <project folder> …` draws a diagram as SVG or draw.io, laid out the same way as in the Modelith app.

This package is part of the Modelith project. Its source is in the
[`cli/` folder of modelith/modelith](https://github.com/modelith/modelith/tree/dev/cli).

## Preview versions

There is no stable release of this package yet. Until there is one, use the preview with `modelith-cli@next`
(plain `npx modelith-cli` does not run). The commands below are written that way.

## Use with an AI client

Register the server with your client. For Claude Code:

```bash
claude mcp add modelith -- npx modelith-cli@next mcp /path/to/project
```

The server offers these tools.

| Tool | What it does |
| --- | --- |
| `list_files` | Lists the model files (`.sysml`, `.kerml`) of the project |
| `list_elements` | Lists the named elements with their qualified name, kind, file and position |
| `get_element` | Gets one element: documentation, type, members, ports and relations |
| `list_diagrams` | Lists the diagrams written in the model as views |
| `list_problems` | Checks the project: syntax errors, missing references, traceability gaps, check rule findings |
| `export_diagram` | Returns a diagram as SVG or draw.io |
| `propose_edit` | Proposes one change **without writing anything**, and returns the changes and the problems afterwards |
| `apply_edit` | Writes a proposal to the model files |

Changes are made in two steps, so that you can see them before they are written. `apply_edit` writes nothing if a file
changed after the proposal.

If you want the AI client to make many changes in a row, start the server with `--write-directly`
(`modelith mcp /path/to/project --write-directly`). The server then also offers `edit`, which makes one change and writes
it in one step. Only the person who starts the server can choose this; a project file cannot turn it on. Use it in a
folder under version control, so that you can undo what was written.

## What it reads and writes

- It reads only inside the project folder you give it, and does not follow symbolic links.
- It writes only existing model files inside that folder, and only through `apply_edit` (and `edit`, when started with `--write-directly`).
- Modelith itself sends your model nowhere. The model is seen only by the AI client you connect.

## Export a diagram

```bash
npx modelith-cli@next export /path/to/project --format svg --diagram Shop::overview > overview.svg
npx modelith-cli@next export /path/to/project --format svg --subject Shop::Cart > cart.svg
npx modelith-cli@next export /path/to/project --format drawio --file shop.sysml --view structure --out shop.drawio
```

## Requirements

Node.js 22 or later.

## License

[AGPL-3.0](https://github.com/modelith/modelith/blob/dev/LICENSE) with the
[Modelith Plugin Exception](https://github.com/modelith/modelith/blob/dev/PLUGIN-EXCEPTION.md).
The package includes the full text in `dist/LICENSE.txt`, and the licenses of the third-party parts built into it in
`dist/licenses.txt`.

SysML® and OMG® are registered trademarks of Object Management Group, Inc. Modelith is an independent project and is
not affiliated with or endorsed by OMG.
