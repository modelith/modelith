# 新しい版が書く配置ファイルの見本

ADR-0023 §6 の見本。新しい版の Modelith が書く配置ファイル（`model.layout.json`）を置き、
この版が読み込んで保存し直しても、知らない項目を消さないこと・`requires` と形式の番号を守って保存しないことを、
`web/src/app/layout-file.test.ts` で確かめる。配置ファイルに新しい項目を足すときは、同じ PR で見本も足す。

| 見本 | 中身 |
| --- | --- |
| `layout-0.2-bends.json` | 0.2.0-beta.2 が書く、線の調整（`@bends`・`@anchors`）を含む配置ファイル（`requires` は無い） |
| `layout-requires.json` | 古い版が守れない機能を `requires` に書き、知らない外側の項目を足した配置ファイル（0.2 は線の調整を使うと `requires` に `edge-shapes` を書く） |
| `layout-format-2.json` | 形式の番号が大きい（古い版が読み違える変更をした）配置ファイル |
