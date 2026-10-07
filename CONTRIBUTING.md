# Contributing to Modelith

## ライセンスと CLA

- 本体は [AGPL-3.0](LICENSE) に [プラグイン例外](PLUGIN-EXCEPTION.md) を付けて提供しています。
- 初めて PR を送る際に **CLA（Contributor License Agreement）への同意**が必要です。
  PR 上で案内が表示されたら手順に従ってください。（CLA 本文と署名の仕組みは準備中です。ADR-0006 参照）

## 開発の流れ

- ブランチ戦略: [docs/development/branching-strategy.md](docs/development/branching-strategy.md)
- 設計判断: [docs/adr/](docs/adr/)
- 完了前に `scripts/check.sh` がグリーンであることを確認してください。CI も同じスクリプトを実行します。

## 必要なツール

- Rust stable（`rust-toolchain.toml` で wasm32 ターゲットごと自動導入）
- Node.js 22（`.nvmrc`）
