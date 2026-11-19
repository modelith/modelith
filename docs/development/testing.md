# テスト

テストの考え方は [testing-principles](../../.claude/skills/testing-principles/SKILL.md)（ISTQB の 7 原則・単体 → 結合 → 統合・AAA）に従う。
何を確かめるべきかは [要求仕様](../reference/requirements.sysml) が決め、テストは `verification def` と、テスト名に書いた要求 ID で要求に結ぶ（ADR-0011）。

## テストの種類と置き場所

| レベル | 何を確かめるか | 置き場所 | 道具 |
| --- | --- | --- | --- |
| 単体 | 1 つの関数・モジュール（I/O なし） | `web/src/**/*.test.ts`、`web/tools/**/*.test.ts`、Rust の `#[cfg(test)]` | Vitest、cargo test |
| 結合 | モジュールの組み合わせ（コアとゴールデン、ワークスペースと偽のファイルシステム、要求仕様の検査） | 同上 | Vitest |
| 統合（e2e） | ビルドしたアプリを Chromium で操作し、要求どおりに動くか（プラグインの隔離は Firefox・WebKit でも、スマホは iPhone・Android の端末の設定で） | `web/e2e/*.spec.ts` | Playwright |
| 統合（UI） | 画面の見た目が変わっていないか（基準画像との比較） | `web/e2e/visual.spec.ts` と基準画像 `visual.spec.ts-snapshots/` | Playwright |

`scripts/check.sh` がこの順に実行し、失敗した段階で止まる。CI も同じ。

### コアは Rust の wasm で確かめる

`web/src/core/golden.test.ts`（ゴールデン）と `spec.test.ts`（仕様のケース）は、Rust のコア（wasm）の解析とモデル構築で動かす（ADR-0015・ADR-0016。暫定の TS コアは beta.1 で削除した）。
Rust がモックと意図して違う結果を出すケースは、`golden.test.ts` の許容リストに理由を添えて登録する。
wasm は `scripts/build-wasm.sh` が `web/src/core/wasm/` に書き出す（コミットしない）。`scripts/check.sh` と `scripts/e2e.sh` は先にこれを実行する。
`npm test --prefix web` を単独で動かすときは、先に `scripts/build-wasm.sh` を実行する。

## 実行

```bash
scripts/build-wasm.sh          # Rust のコアの wasm を作る（web のテストとアプリが使う）
npm test --prefix web          # 単体・結合
scripts/e2e.sh                 # e2e・UI（ビルドしてから、基準のブラウザで操作する）
scripts/e2e.sh -g F-FILE       # 要求 ID でしぼる（引数は Playwright にそのまま渡す）
```

別の作業ツリーで同時に動かすときは、ポートを変える（同じポートだと、もう一方が配信しているアプリやブラウザにつながる）。

```bash
PW_APP_PORT=4181 PW_REFERENCE_PORT=3124 scripts/e2e.sh   # アプリの配信（既定 4180）と、基準のブラウザ（既定 3123）
```

### 基準のブラウザ

画面の画素は、同じ Chromium でも OS のフォントや描画の設定で変わる（改行の位置がずれることもある）。
どこで動かしても同じ画像になるよう、`scripts/e2e.sh` はブラウザを **Playwright の公式イメージ（Docker）** の中で動かし、
テストは手元の Node から、そのブラウザにつなぐ（Playwright の `run-server`）。

- イメージの版は `web/package.json` の `@playwright/test` と同じにする（版を固定する）。Playwright を上げたら、基準画像も作り直す。
- 手元・CI・公開のワークフローは、すべて同じイメージを使う。手元で通れば CI でも通る。
- Docker が無い手元では、手元の Chromium で e2e だけを動かし、UI テストは飛ばす（見た目は CI で比べる）。CI では Docker が無ければ失敗にする。
- クラウドの作業環境（Claude Code on the web）では、セッションの開始時に Docker のデーモンが止まっているので、`scripts/e2e.sh` が起動する。

### プラグインの隔離は 3 つのブラウザで確かめる

v1 のプラグインの隔離（ADR-0018 §3.1）は、ブラウザごとに振る舞いが違う（Firefox では Worker の中の `EventSource` が CSP をすり抜ける、など）。
そのため `web/e2e/script-plugins.spec.ts` の「隔離」のまとまり（通信を止める・保存場所と親の画面に触れない・止まらない処理を止める）は、
Chromium に加えて Firefox と WebKit でも動かす（`playwright.config.ts` の projects。基準のブラウザのイメージに 3 つとも入っている）。`scripts/check.sh` の e2e に含まれる。

- 追加でかかる時間は 1 分足らず（2026-10-19、クラウドの作業環境で計測。e2e 全体が Chromium だけで 4.4 分、3 つのブラウザで 5.0 分）。
- WebKit（Linux）には OPFS が無いので、このまとまりはフォルダを開けないブラウザとして、「このブラウザ」に追加したプラグインで確かめる（`test.use({ fsAccess: false })`）。
- 1 つのブラウザだけを動かすときは `scripts/e2e.sh --project firefox`（`chromium`・`webkit`）。

### スマホは端末の設定で確かめる

狭い画面のテキストの読み取り専用・「編集」ボタン・ダブルタップでの語の説明（F-EDIT-10）は、タッチとモバイルの表示に頼る。
そのため `web/e2e/mobile.spec.ts` は、Playwright の端末の設定（画面の大きさ・タッチ・モバイルの表示）で、
`mobile-safari`（`devices["iPhone 13"]`、WebKit）と `mobile-chrome`（`devices["Pixel 5"]`、Chromium）の 2 つのプロジェクトで動かす。
ブラウザは、プラグインの隔離と同じく基準のブラウザのイメージのものを使う。`chromium` のプロジェクトは、このファイルを動かさない。

- スマホのブラウザにはフォルダを開く API が無いので、フォルダを開けないブラウザとして動かす（`test.use({ fsAccess: false })`）。
- ダブルタップは `page.touchscreen.tap` を 2 回続けて送り、ブラウザの `dblclick` に頼らずに確かめる。
- スマホだけを動かすときは `scripts/e2e.sh --project mobile-safari --project mobile-chrome`。

## レポート（人が読むもの）

| レポート | 中身 | どこで見るか |
| --- | --- | --- |
| 要求別の表（`reports/requirements.html`） | システム要求ごとに、合格・失敗・単体／結合で検証・未検証 | CI のジョブのサマリ（同じ表）、CI の成果物 `test-reports`、公開版の「ヘルプ」→「この版のテスト結果」 |
| Playwright のレポート（`reports/e2e/`） | テストごとの手順・最後の画面。失敗したときは操作の記録（trace）、UI テストの「基準・今回・差分」 | CI の成果物 `test-reports`、手元では `npx playwright show-report reports/e2e`（`web/` で実行）、CI が失敗したときは <https://modelith-dev.github.io/>（下の「失敗した CI のテスト結果のページ」） |

公開版（GitHub Pages）には、その版で実行したレポートを `reports/` に一緒に載せる。テストが失敗したら公開しない。

### 失敗したときの要約（ログで読むもの）

e2e が失敗して終わると、`scripts/e2e.sh` が、失敗したテストごとの要約を標準出力（CI では `check` ジョブのログ）に出す。
成果物（trace・画面）を取り出せない環境でも、ログだけで「どの操作のあとに何が起きたか」を調べられるようにするため。成功したときは何も出さない。

ログの中では `=====BEGIN E2E FAILURE: <テスト名>=====` から `=====END E2E FAILURE=====` までを探す。中身は 3 つ。

| 節 | 中身 | 読み方 |
| --- | --- | --- |
| 操作の一覧 | テストの操作（クリック・入力・待ち・`expect`・`test.step`）を始まった順に。番号・始まり（最初の操作からの秒）・かかった時間・呼び出した場所 | 行の先頭の `✗` が失敗した操作で、すぐ下の `\|` の行がそのエラー。「終わらず」は、時間切れなどで終わりの記録が無い操作。長いときは最後の 40 件だけを出し、省いた件数を先頭に示す |
| ブラウザのエラー | コンソールの error・warning（`console.error`・`console.warning`）、ページの例外（`pageerror`）、失敗した通信（`request`。状態が 400 以上か、つながらなかったもの） | 行の終わりの「← 「…」のとき」は、それが起きたときに始まっていた最後の操作 |
| 失敗したときの画面 | Playwright が書き出す `error-context.md` のうち、エラーとページのスナップショット（画面の要素を文字にしたもの） | 待っていた要素が画面に無かったのか、別の文言が出ていたのかを確かめる。長いときは上限で切り、切ったことを示す |

- 要約を作るのは `web/tools/e2e-failure.ts`（判断）と `web/tools/e2e-failure-cli.ts`（`web/test-results/` を読む。trace.zip の展開に `unzip` コマンドを使う）。手元でもう一度出すには `node web/tools/e2e-failure-cli.ts web/test-results`。
- 要約は trace（`playwright.config.ts` の `trace: "retain-on-failure"`）から作る。trace を残さない設定で動かしたとき（`--trace off`）は、失敗したときの画面だけを出す。
- 画像（失敗時の画面・UI テストの差分）はログに出ない。成果物 `test-reports` の Playwright のレポートか、下の「失敗した CI のテスト結果のページ」で見る。
- 失敗したテストが多いときは、最初の 10 件だけを要約し、残りは名前だけを出す。
- trace の形は Playwright の版で変わりうる。`@playwright/test` の版を上げたら、わざと失敗するテストを一時的に書いて `scripts/e2e.sh` で流し、要約が出ることを確かめる。知らない形の記録は飛ばすので、形が変わっても e2e の成否は変わらない（要約の中身が減る）。

### 失敗した CI のテスト結果のページ（画面と操作の再生を見るもの）

CI の `check` ジョブが失敗すると、ワークフロー `CI reports`（`.github/workflows/ci-reports.yml`）が、成果物 `test-reports` の中身を <https://modelith-dev.github.io/> に置く。
成果物を取り出せない環境（エージェントなど）でも、失敗時の画面・UI テストの差分・操作の再生（trace）をブラウザで見られるようにするため。

| 場所 | 中身 |
| --- | --- |
| `https://modelith-dev.github.io/` | 置いてある実行の一覧（始まった日時・ブランチ・PR・コミット・CI の実行・結果のページ） |
| `…/runs/<実行の ID>-<やり直しの回数>/report/e2e/index.html` | Playwright のレポート。失敗したテストを開き、「Traces」から操作の再生を見る |
| `…/runs/<実行の ID>-<やり直しの回数>/report/requirements.html` | 要求別の表 |
| `…/runs/<実行の ID>-<やり直しの回数>/meta.json` | その実行のメタデータ（一覧はここから作る） |

- PR の実行なら、その PR に結果のページへのリンクのコメントが付く（`github-actions[bot]` の、`<!-- ci-reports -->` で始まるコメント。同じ PR では書き換え、増やさない）。
- 残すのは、新しく置いたものから 10 回分（全体で 900 MB まで）。古いものは次に置くときに消えるので、リンクは切れることがある。
- 置かない場合：`check` ジョブが失敗していない（PR のタイトルなど、ほかのジョブの失敗）、成果物が無い（e2e まで進まずに落ちた）、成果物が大きすぎる（1 回分が 200 MB 超、または 95 MB を超えるファイルがある）、Playwright のレポートも要求別の表も無い。理由はワークフローのログに出る。
- 判断（置く成果物・大きさ・掃除・一覧の HTML・コメントの文）は `web/tools/ci-reports.ts`、ファイルの入出力は `web/tools/ci-reports-cli.ts`、GitHub の API と git は `scripts/ci-reports.sh`。上限の値は `ci-reports.ts` の `DEFAULT_LIMITS`。
- ワークフローは、成果物の名前 `test-reports` とジョブの名前 `check`（`.github/workflows/ci.yml`）に頼っている。どちらかを変えるときは `ci-reports.ts` の `ARTIFACT_NAME`・`CHECK_JOB` も変える。

#### 安全の考え方

- **アプリとは別のオリジンに置く。** テスト結果のページは、PR（フォークを含む）の中身から作られる、信頼できない HTML と JavaScript。
  アプリ（`modelith.github.io`）と同じオリジンに置くと、そのページのスクリプトが、アプリの下書き・設定・フォルダを開く許可に届いてしまう。だから organization もサイトも分けている（`modelith-dev.github.io`）。置き場所のページに、個人の情報や秘密を入力しない。
- **PR のコードを実行しない。** `CI reports` は `workflow_run` で動き、フォークの PR のあとでも、secret を持って本体の文脈で動く。checkout するのは既定ブランチ（`dev`）のスクリプトだけで、成果物は写すだけ（中のものを読まない・実行しない）。
  シンボリックリンク、ファイルでもフォルダでもないもの、名前が `.git` で始まるものは、写す前に消す。
- **信頼できない文字列を、シェルの文や HTML にそのまま入れない。** ワークフローは実行の ID だけを受け取り、ブランチ名などは API から取り直して、形を確かめ、一覧では HTML としてエスケープする。PR へのコメントにはブランチ名を入れない。
- **書き込みの権限を小さくする。** 置き場所へは GitHub App のトークンで書く。App は `modelith-dev/modelith-dev.github.io` にだけ入っていて、権限は Contents の読み書きだけ。トークンは 1 時間で切れ、成果物を扱い終えたあとの、書き込む手順にだけ渡す。
  secret は `CI_REPORTS_APP_ID`（App の ID）と `CI_REPORTS_APP_PRIVATE_KEY`（秘密鍵）で、`modelith/modelith` の Actions の secret に登録してある。

#### 置き場所の履歴（force-push する）

1 回分が約 60 MB あるので、コミットを積むと置き場所のリポジトリがすぐ大きくなる。そこで、置くたびに `main` を「親の無い 1 つのコミット」に作り直して置き換える（`git push --force-with-lease`）。
置き場所は生成物だけのリポジトリで、人は書き込まない。[ブランチ戦略](branching-strategy.md) の「force-push 禁止」は本体のリポジトリの決まりで、ここには当てはめない。
取ってきたあとにほかの書き込みがあったときは、置き換えずに失敗する（ワークフローは `concurrency` で 1 つずつ動く）。

#### 試し方

- 手元：`tests/harness/node_modules/.bin/bats tests/harness/integration/ci-reports.bats`（GitHub の API は `gh` のスタブ、置き場所は手元のリポジトリで置き換える）。
- GitHub：Actions の `CI reports` を手で起動し、`run_id` に、`check` ジョブが失敗した CI の実行の ID（Actions の URL の `runs/` のあとの数）を渡す。`comment` にチェックを入れると、その実行の PR にコメントも付ける。
  `workflow_run` も手での起動も、ワークフローが既定ブランチ（`dev`）に入ってからしか動かない。
- 続けて何度も失敗すると、待っている実行は最新の 1 つだけになる（GitHub の `concurrency` の決まり。間の実行の結果は置かれない）。

## e2e の書き方

- テスト名の先頭に要求 ID を書く（例: `F-FILE-2: …`。複数なら `F-EDIT-2・C-1: …`）。要求別の表はこの ID で集計する。
- 共通部品は `e2e/fixtures.ts`。ローカルフォルダは OPFS（ブラウザ内の本物のファイルシステム）で代用し、ピッカーだけを置き換える。
  「このブラウザ」に追加したプラグインは `putBrowserPlugin` で IndexedDB に直接置ける（置いた後に開き直す）。フォルダを選ぶ入力欄（フォルダを開けないブラウザ）には、`filechooser` の `setFiles(<手元のフォルダ>)` でフォルダを渡す。
- 画面で例外が出たら、どのテストも失敗にする（fixtures が確かめる）。
- 待つときは `expect(...).toHave...` や `expect.poll` を使い、決め打ちの `waitForTimeout` は入力の反映待ち（0.28 秒）など理由があるときだけにする。

## UI テストの基準画像を更新する

意図して見た目を変えたときだけ更新する。

1. `scripts/e2e.sh e2e/visual.spec.ts` で、どの画面が変わったかを確かめる（レポートに差分が出る）。
2. 変化が意図どおりなら、`scripts/e2e.sh e2e/visual.spec.ts --update-snapshots=all` で基準画像を作り直す。
   変わっていない画像は、同じ内容のまま書き直されるので差分に出ない。
3. 更新した画像を PR に含め、PR の説明に「何が・なぜ変わったか」を書く。レビューでは画像の差分を確かめる。

手元に Docker が無いときは、CI で作り直す。

1. トピックブランチのコミットメッセージに `[ui-baselines]` を含めて push する。
2. ワークフロー `UI baselines` が同じ基準のブラウザで基準画像を作り、成果物 `ui-baselines` に置く。
   成果物を取れない環境（エージェントなど）のために、ログの `=====BEGIN UI BASELINES=====` から `=====END UI BASELINES=====` の間にも
   tar.gz を base64 で出す（`base64 -d | tar xz -C web/e2e` で展開できる）。
3. 展開した画像を `web/e2e/visual.spec.ts-snapshots/` に置いてコミットし、差分を確かめてから push する。
