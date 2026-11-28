# リリース手順

[バージョン規則](../reference/versioning.md) と [ブランチ戦略](branching-strategy.md) に基づく、リリースの具体的な手順。

## 段階とブランチの対応

[ADR-0022](../adr/0022-three-release-channels.md) に従い、`dev` で次の版を作り、`main` で候補（rc）と安定版を仕上げる。

| 段階 | タグを打つブランチ | 版を書き換える PR の向け先 | `main` へのマージ |
| --- | --- | --- | --- |
| alpha・beta | `dev` | `dev`（Squash） | しない |
| rc.1 | `main` | `dev` で書き換えてから、`dev` → `main` | 必要（メンテナの許可、マージコミット） |
| rc.2 以降・正式版・パッチ | `main` | `main`（`chore/release-v<版>`） | 必要（メンテナの許可、マージコミット） |

- `dev` → `main` をマージするのは、次の版の rc.1 を出すときだけ。前の rc が正式版になるまでは行わない。
- `main` に入れたものは、すぐに `dev` に戻す（下の「`main` を `dev` に戻す」）。

## alpha・beta を出す

1. `dev` が CI グリーンであることを確認する。
2. `dev` から `chore/release-v<版>` を作り、`scripts/release-prepare.sh <版>` を実行する。
   版（`Cargo.toml`・`web/package.json` とそれぞれのロックファイル）を書き換え、リリースノートのひな形 `docs/releases/v<版>.md` を作る。
3. リリースノートの「（ここに書く）」を埋め（下の「リリースノート」）、`node web/tools/release-notes-cli.ts check <版>` で確かめる。
4. PR（`chore(release): v<版>`）を `dev` に向けて出し、CI グリーンで Squash merge する。
   マージすると「Release draft」ワークフローが動き、`dev` のマージコミットを対象に、リリースの下書き（プレリリース）を作る。
5. メンテナが下書きを確かめ、「Publish release」を押す。このときタグ `v<版>` が作られ、`.github/workflows/pages.yml` が Web アプリを GitHub Pages に公開する（下の「公開先」）。
6. 公開後、公開した版が出るはずの URL で、画面左上のメニューの「ヘルプ」のバージョンを確かめ、[リリース計画](release-plan.md) のその行に「（公開済み）」を足す。

エージェントは 1〜4 と 6 を行い、5 の公開だけをメンテナに頼む（[release スキル](../../.claude/skills/release/SKILL.md)）。

## rc を出す

**rc.1（次の版の候補を始める）**

1. 上の 1〜4 を rc.1 の番号で行う（`dev` へのマージでは下書きは作られない）。
2. 前の版の正式版が出ていて、`main` で進んでいる候補が無いことを確かめる。
3. `dev` → `main` の PR（`chore(release): v<版>`）を作る。**マージにはメンテナの明示的な許可が必要。** 方式はマージコミット。
   マージすると、`main` のマージコミットを対象に下書きが作られる。
4. メンテナが下書きを公開する。

**rc の間の修正と、rc.2 以降**

1. 不具合は `main` から `fix/<topic>` を作って直し、`main` に向けて PR を出す。マージにはメンテナの許可が要る（マージコミット）。次の版の機能（`feat/*` など）は `main` に入れない。
2. 入れたら、すぐに `main` を `dev` に戻す（下の「`main` を `dev` に戻す」）。
3. 次の rc は、`main` から `chore/release-v<版>` を作り、上の 2〜3 と同じく版とノートを書き換え、`main` に向けて PR を出す（メンテナの許可、マージコミット）。マージすると下書きが作られる。
4. メンテナが下書きを公開し、`main` を `dev` に戻す。

## `main` を `dev` に戻す

- `main` → `dev` の PR を作り、マージコミットで入れる（許可は要らない）。Squash にすると `main` が `dev` の祖先にならないので、使わない。
- 同じ場所を両方が変えていてそのまま戻せないとき（`dev` に次の版の機能が入っているので、よく起きる）は、`dev` から `sync/<topic>` を作り、`main` を取り込んで食い違いを直し、`dev` に向けた PR をマージコミットで入れる（許可は要らない）。
  食い違いを直すときは、`main` の修正が `dev` の新しい機能でも正しく働くかを確かめ、要るなら同じブランチで合わせる。
- 戻していないと、1 時間ごとの確認（`sync-check.yml`）が Issue「main に入れたものが dev に戻っていません」を開き、`dev` での alpha・beta の下書きも作られない（`scripts/check-main-in-dev.sh`）。戻すと Issue は自動で閉じる。

## 公開先（安定版・リリース候補版・プレビュー版）

[ADR-0022](../adr/0022-three-release-channels.md) に従い、1 つのサイトに 3 つの系列を置く。

| 系列 | URL | 置く版 |
| --- | --- | --- |
| 安定版 | `https://modelith.github.io/modelith/` | 最新の正式版。正式版が無ければ最新の rc |
| リリース候補版 | `https://modelith.github.io/modelith/rc/` | 正式版がまだ出ていない、最新の rc。無いときは安定版への案内のページ |
| プレビュー版 | `https://modelith.github.io/modelith/preview/` | 最も新しい版（alpha・beta・rc・正式版） |

- 版の選び方は `web/tools/channels.ts`。人は選ばず、公開済みのリリースのタグから決まる。
- 版ごとのアプリは、系列ごとに 1 回だけ、そのタグの中身をそのタグの `.nvmrc` の Node.js でテストして組み立て（`scripts/pages-build-one.sh`）、そのリリースに `modelith-web-<系列>.tar.gz` として添付する。
  公開済みの版は後から直せないので、落ちたテストは 1 回だけやり直す。
  系列（`MODELITH_CHANNEL`）を渡して組み立てるので、利用状況の報告（ADR-0026）では、その系列を名乗る（系列を渡さないビルドは「そのほか」）。
- 公開は、添付したアプリを並べるだけ（`scripts/pages-assemble.sh`）。古い版を作り直したり、テストし直したりしない。添付が無い版だけ、その場で作って添付する。
- リリース候補版とプレビュー版は、ブラウザの保存領域（前回の続き・下書き・設定・プラグインの許可）を安定版と分ける（`@rc`・`@preview` を付けた名前）。
- 公開は、必ず `dev` の `.github/workflows/pages.yml` の定義で行う。リリースを公開すると、タグのコミットの `pages.yml` が `dev` の定義を起動する。
  `github-pages` の公開先は `dev` だけなので、この仕組みより前のタグの `pages.yml` が動いても、公開の段階で失敗し、サイトは変わらない。
  そうしたタグ（`v0.2.0-beta.2` 以前）を公開したときは、Actions の「Pages」を `dev` から手動で起動する。
- 公開し直すとき（添付の作り直しを含む）も、Actions の「Pages」を `dev` から手動で起動する。作り直したい版は、その添付を消してから起動する。
- 正式版や候補を取り下げるときは、そのリリースを下書きに戻してから、「Pages」を起動する。選び直しで 1 つ前の版に戻る。

## CLI と MCP のサーバのパッケージ

リリースを公開すると、`.github/workflows/release-cli.yml` が、そのタグの中身から npm のパッケージ `modelith-cli`（[ADR-0028](../adr/0028-npm-package-names.md)）を組み立て、
動くことを確かめてから（`scripts/build-cli.sh --smoke`）、リリースに `modelith-cli-<版>.tgz` を添付する（`scripts/release-cli.sh`）。

- 版は、本体と同じ（`scripts/release-prepare.sh` が `cli/package.json` も書き換える）。タグの版と違うときは、添付しない。
- 添付し直すとき（組み立てに失敗した・添付を消したとき）は、Actions の「Release CLI」を、タグを渡して手で動かす。その版がもう npm で公開されていれば、npm に置くのは飛ばす（公開済みの版は置き直せない）。
- 添付した `.tgz` は、npm のレジストリを使わずに入れられる：`npm install -g https://github.com/modelith/modelith/releases/download/v<版>/modelith-cli-<版>.tgz`。

### npm のレジストリへの公開

npm への公開は、2 段階で行う（ADR-0028 の 3）。

1. 同じワークフローが、添付したのと同じ `.tgz` を、npm に「置く」（`scripts/release-cli-npm.sh`。`npm stage publish`）。置いただけでは公開されない。
   印（dist-tag）は、プレリリース版は `next`、正式版は `latest`。
2. メンテナが、npm のパッケージのページ（<https://www.npmjs.com/package/modelith-cli>）で置かれた版を見て、2 段階認証をして承認する。承認すると公開される。
   手元のコマンドでもできる：`npm stage list modelith-cli` で一覧、`npm stage approve <ID>` で承認、`npm stage reject <ID>` で取り下げ。

置き直すとき（置くのに失敗した・取り下げたとき）は、Actions の「Release CLI」を、タグを渡して手で動かす。同じ版を 2 回は置けないので、置いたままの版は、先に取り下げる。

#### 初期設定（一度だけ）

ワークフローは鍵を持たず、npm との結び付け（Trusted Publishing）で入る。結び付けは、npm にパッケージがあってからでないと登録できないので、最初の 1 回だけは、メンテナが手元から公開する。
npm のコマンドは 11.15.0 以上を使う（`npm install -g npm@latest`）。トークンや合言葉を、リポジトリ・Issue・チャットに書かない。

1. 最初の版を公開する。リリースに添付された `.tgz`（ワークフローが組み立てたもの）を取ってきて、そのまま出す。手元で組み立てたものは出さない。

   ```bash
   npm login
   curl -LO https://github.com/modelith/modelith/releases/download/v<版>/modelith-cli-<版>.tgz
   npm publish ./modelith-cli-<版>.tgz --tag next   # 正式版なら --tag latest
   ```

   正式版がまだ無いときは、npm が最初の版に `latest` も付けるので、`latest` を仮の置き場の版に向け直し、注意書きを付ける（ADR-0028 の 3）。
   仮の置き場の版（`0.0.0-stage`）は、npm のサイトでパッケージの名前を先に取ったときにできる。無ければ、この手順は飛ばす。

   ```bash
   npm dist-tag add modelith-cli@0.0.0-stage latest
   npm deprecate modelith-cli@0.0.0-stage "There is no stable release of modelith-cli yet. Use the preview: npx modelith-cli@next"
   npm view modelith-cli dist-tags   # latest が 0.0.0-stage、next が出した版になっていること
   ```

   正式版を `--tag latest` で出すと、`latest` はその版に移る。仮の置き場の版と注意書きは、残したままでよい。

2. 結び付けを登録する。「置く」ことだけを許す（`--allow-publish` は付けない）。

   ```bash
   npm trust github modelith-cli --repo modelith/modelith --file release-cli.yml --allow-stage-publish
   ```

   npm の画面でもできる（パッケージのページ → Settings → Trusted Publisher）。
3. npm のパッケージの Settings（パッケージの公開の権限の欄）で、「Require two-factor authentication and disallow tokens」を選ぶ（トークンでは公開できなくする）。
4. GitHub のリポジトリの Settings → Secrets and variables → Actions → Variables に、`NPM_STAGE_PUBLISH` = `true` を足す。これが無い間、ワークフローは npm の段を飛ばす。

## GitHub Pages の初期設定（一度だけ）

- Settings → Pages → Build and deployment の Source を **GitHub Actions** にする。
- Settings → Environments → `github-pages` → Deployment branches and tags を **`dev` だけ** にする（タグ `v*` や `main` からは公開させない。ADR-0022）。

## 正式版を出す

1. 最後の rc で、一定期間（目安 1 週間）重大な報告がないことを確認する。
2. `main` から `chore/release-v<版>` を作り、段階の接尾辞を外した版とノートを書き換え、`main` に向けて PR を出す（メンテナの許可、マージコミット）。マージすると下書きが作られる。
3. メンテナが下書きを通常のリリースとして公開する。公開したら `main` を `dev` に戻す。

## 安定版のパッチ

修正を出すのは最新の系列だけ（ADR-0022）。

- 候補が進んでいないときは、`main` で `fix/*` を直し、上の「正式版を出す」と同じ手順で `X.Y.(Z+1)` を出す。rc を経るかはメンテナが決める。
- 候補が進んでいる間は、その候補に入れて、次の正式版で届ける。データを失う不具合や安全の問題で待てないときだけ、メンテナの判断で安定版のタグから一時的なブランチを作って出す。

## リリースノート

版ごとに `docs/releases/v<版>.md` に置き、GitHub のリリースの本文にそのまま使う。読み手は利用者で、形は決めてある。

1. `# Modelith <版>`
2. この版で何が変わったかの要約（1 段落）
3. 変更の種類ごとの節（この順に 1 つ以上）：`## 新しい機能`・`## 改善`・`## 不具合の修正`・`## その他`。それぞれ「- 項目の名前：何がどう変わったか」の箇条書き
4. `## <前の版> をお使いの方へ`（任意）：保存形式の変更など、前の版から移る人への注意
5. ご注意・商標・ライセンス（決まった部分。`web/tools/release-notes.ts` の `FOOTER`）

形は `scripts/check.sh` が検査する（`release-notes-cli.ts check`）。書き方の細則は [release スキル](../../.claude/skills/release/SKILL.md)。
公開済みの版の本文を直すときは、ファイルを直す PR をマージしてから「Release draft」を版を渡して手で起動する（本文だけを差し替える）。
