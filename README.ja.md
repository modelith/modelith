<p align="center">
  <img src="https://raw.githubusercontent.com/modelith/.github/main/profile/logo.svg" width="88" height="88" alt="Modelith">
</p>

<h1 align="center">Modelith</h1>

<p align="center">
  <b>テキストと図を同期して編集できる、オープンソースの SysML v2 モデリングエディタ</b><br>
  <sub>SysML v2 / KerML modeling editor with synchronized text and diagram editing</sub>
</p>

<p align="center">
  <a href="README.md">English</a> &nbsp;|&nbsp;
  <a href="https://modelith.github.io/modelith/"><b>ブラウザで試す</b></a> &nbsp;|&nbsp;
  <a href="https://modelith.github.io/">ユーザーマニュアル</a> &nbsp;|&nbsp;
  <a href="https://github.com/modelith/modelith/releases">リリース</a> &nbsp;|&nbsp;
  <a href="https://modelith.github.io/modelith/reports/requirements.html">テスト結果</a> &nbsp;|&nbsp;
  <a href="https://github.com/modelith/modelith/issues/new/choose">フィードバック</a> &nbsp;|&nbsp;
  <a href="https://github.com/sponsors/modelith">支援する</a>
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
      <img src="https://raw.githubusercontent.com/modelith/.github/main/profile/screenshot.png" width="800" alt="Modelith の画面。左にファイル、中央にトレーサビリティの図、右に SysML v2 のテキスト">
    </picture>
  </a>
</p>

## Modelith とは

システムエンジニア・学生・研究者のための、SysML v2 のモデリングエディタです。
テキストで書いたモデルがすぐ図になり、図で動かした内容はテキストに書き戻されます。

- **書いても、描いても、同じモデル** — テキストを打てば図に反映し、図で要素や関係を足せばテキストが書き換わります。
- **目的に合わせた図** — ブロック定義図・内部ブロック図・アクティビティ図・状態遷移図・シーケンス図・トレーサビリティなど、同じモデルを見たい切り口で表示できます。SVG や draw.io 形式でエクスポートすることもできます。
- **要求の抜けに気づける** — 利用者要求から方式設計・検証までのつながりをたどり、導出・充足・検証の抜けを示します。
- **SysML v2 を知らなくても読める** — テキストのキーワードや図の名前にマウスを乗せると、その意味を表示します。
- **ブラウザを開くだけ** — インストールもアカウントも不要です。手元のフォルダを VS Code のように開いて、編集・保存できます。
- **モデルは手元から出ない** — モデルを外部に送信せず、アクセス解析も使いません。モデルはただのテキストファイルなので、Git で差分を追えます。

## はじめる

**<https://modelith.github.io/modelith/>** をブラウザで開くと、サンプルのモデル（電気ケトル）が表示されます。使い方は [ユーザーマニュアル](https://modelith.github.io/) をご覧ください。

Modelith は 3 つの系列で公開しています。前回の続き・下書き・設定は、系列ごとに別に保存されます。

| 系列 | URL | 中身 |
| --- | --- | --- |
| 安定版 | <https://modelith.github.io/modelith/> | 最新の正式版 |
| リリース候補版 | <https://modelith.github.io/modelith/rc/> | 最新のリリース候補版（出ている間だけ） |
| プレビュー版 | <https://modelith.github.io/modelith/preview/> | 次の版の最新の alpha・beta。開発中の新しい機能を試せます |

| 環境 | できること |
| --- | --- |
| Chrome・Edge | フォルダを開いて、ファイルを直接編集・上書き保存 |
| Safari・Firefox | ファイルの読み込みと、ダウンロードでの保存 |
| スマホなど幅の狭い画面 | モデルを見て確かめる（テキストは読み取り専用で開き、「編集」で書き換える） |

画面は今のところ日本語です。英語の画面は 0.4.0 で入れる予定です。

## SysML v2 の対応状況

SysML v2 のテキストの書き方のうち、よく使う部分に対応し、よく使う図に描きます。

- **書き方**：パッケージと `import`、定義と使用（`part`・`item`・`attribute`・`port`・`enum`・`occurrence` など）、接続・インタフェース・流れ、アクション、状態と遷移、要求・`satisfy`・`verify`・導出、ユースケース、`expose` と `filter` を使うビュー、コメントとメタデータ。0.2.0 から、フォルダの中の複数のファイルにまたがるモデルも扱えます。
- **図**：ブロック定義図・一般の図、内部ブロック図、アクティビティ図、状態遷移図、シーケンス図、トレーサビリティ。SVG と draw.io にエクスポートできます。
- **まだできないこと**：式は文字列として持つだけで、計算しません。KerML・標準ライブラリ・モデル交換の形式（`.kpar`）にはまだ対応していません。まだ読めない書き方は、黙って捨てずに問題一覧で知らせます。

残りの書き方は、次の順に対応します（書き方ごとの状況は [対応表](docs/reference/sysml-conformance.md) にあります）。

| 版 | 書き方 |
| --- | --- |
| 0.3.0 | フィルタ付きの `import Q::*[@F]`、package 直下の `filter @X;`、関係の本体の `doc`・`comment`、複数の型 `: A, B`、値付きの列挙値、式の書き方（値と単位 `1500 [kg]`、本体付きの式 `->collect{ … }`。計算はしない） |
| 0.4.0 | KerML（`classifier`・`struct`・`function` などの宣言。`.kerml` のファイルを読む） |
| 0.5.0 以降 | 式の計算と単位、標準ライブラリの同梱、ジオメトリ・グリッド・ブラウザのビュー、シーケンス図と状態遷移図の残り、モデル交換の形式（`.kpar`） |

予定は利用者の声に合わせて入れ替えることがあります。必要な書き方があれば、[Issues](https://github.com/modelith/modelith/issues/new/choose) でお知らせください。

## ロードマップ

**0.1.0** が最初の正式版です。**0.2.0** は正式版の候補（rc）を出していて、リリース候補版で試せます。

| 版 | できるようになること |
| --- | --- |
| 0.1.0 | 同じモデルをテキストでも図でも書ける。要求のトレーサビリティ、エクスポート、検査ルールなどのプラグイン |
| 0.2.0 | 図を作る、テキストを書かずに画面で編集できることを増やす、線の調整、エクスポートの強化、要求図・ブロック定義図・内部ブロック図・アクティビティ図の不足を埋める、複数のファイルにまたがるモデル |
| 0.3.0 | AI（Claude・Codex など）が、MCP で手元のモデルを読み、確かめ、書き換え、図を書き出す。SysML v2 の書き方を増やす |
| 0.4.0 | AI の書き換えが開いている画面に出て、元に戻せる。KerML。英語の画面とマニュアル |
| 0.5.0 | 自分で動かしたサーバにプロジェクトを置き、どのパソコンからも開ける |
| 0.6.0〜0.8.0 | ほかの人と共有する、同時に編集する、つながっていない間も編集を続ける |

詳しくは [リリース計画](docs/development/release-plan.md) と [リリース計画（0.3.0 から先）](docs/development/release-plan-0.3.0.md)、各版の変更点は [リリース](https://github.com/modelith/modelith/releases) をご覧ください。

## ドキュメント

| 文書 | 内容 |
| --- | --- |
| [ユーザーマニュアル](https://modelith.github.io/) | 使い方（画面・ファイル・図・SysML v2 の書き方入門・プラグイン） |
| [SysML v2 の対応表](docs/reference/sysml-conformance.md) | 規格の書き方ごとの対応状況 |
| [検査ルール](docs/reference/check-rules.md)・[スクリプトのプラグイン](docs/reference/script-plugins.md) | プラグインの作り方 |
| [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) | 開発に参加する方法（手元で動かす・構成・開発者向けの文書） |
| [SECURITY.ja.md](SECURITY.ja.md) | セキュリティの問題を見つけたときの、非公開の報告の仕方 |

## 開発に参加する

使ってみた感想や「こんな図がほしい」は、[Issues](https://github.com/modelith/modelith/issues/new/choose) にお寄せください。
コードで貢献するときは、[CONTRIBUTING.ja.md](CONTRIBUTING.ja.md)（CLA を含む）を先にお読みください。

| リポジトリ | 内容 | ライセンス |
| --- | --- | --- |
| [modelith](https://github.com/modelith/modelith) | エディタ本体（Rust コア・Web アプリ・CLI） | AGPL-3.0 + [Plugin Exception](PLUGIN-EXCEPTION.md) |
| [plugin-sdk](https://github.com/modelith/plugin-sdk) | プラグイン向けのインタフェース・型定義 | MIT |
| [modelith.github.io](https://github.com/modelith/modelith.github.io) | ユーザーマニュアル | MIT |

## 支援する

Modelith の開発を続けるための支援を、[GitHub Sponsors](https://github.com/sponsors/modelith) で受け付けています。
GitHub のアカウントがあれば、毎月または 1 回だけの支援を選べます。

<a href="https://github.com/sponsors/modelith"><img src="https://img.shields.io/badge/sponsor-modelith-ea4aaa?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors で支援する"></a>

### スポンサー

Modelith を支援してくださっている方々です。毎月 $10 以上のプランの方を、ここに掲載しています。掲載を望まない場合は、お知らせください。

<!-- 企業スポンサー（毎月 $100）: ロゴとリンク -->

<!-- サポーター（毎月 $10）: GitHub アカウント -->

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
