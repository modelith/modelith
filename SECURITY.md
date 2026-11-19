# Reporting security issues

English | [日本語](SECURITY.ja.md)

If you find a security issue in Modelith (a user's model is sent outside, the plugin sandbox can be escaped, scripts can be run on someone else's screen, and so on), **do not open a public issue**. Please tell us through GitHub's private reporting.

- Where to report: [Report a vulnerability](https://github.com/modelith/modelith/security/advisories/new) (the "Security" tab of this repository → "Report a vulnerability")

Please include the following, as far as you know.

- What it allows (the impact)
- Steps to reproduce (the model text, the plugin folder, the order of operations)
- The browser you used and the Modelith version (shown under "ヘルプ" (Help) at the top right of the screen)

Reports in English or Japanese are welcome.

## Scope

| Target | Examples |
| --- | --- |
| The web app (<https://modelith.github.io/modelith/>) | Injecting scripts into the page, connections to anywhere other than where it is served from, leaking drafts or the contents of an opened folder |
| The plugin sandbox | Reaching outside the sandbox (the app's page, browser storage, the opened folder), using permissions that were not declared, making connections that were not declared |
| The command-line `modelith check` | Reading or writing files outside the project folder |

For issues in a plugin itself (one made by a third party), please contact the author of that plugin.

## How we respond

- We will acknowledge your report as soon as we can.
- Please keep the details private until it is fixed. After we publish a fixed version, we will credit the report, and your name if you wish, in the release notes.
- For versions before 0.1.0 (alpha, beta, rc), only the latest version is fixed.
