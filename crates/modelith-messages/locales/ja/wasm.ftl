# wasm の入口（crates/modelith-wasm）が作る文。画面と、Node で動く MCP のサーバが出す。
# キーは、コードの「.」を「-」に替えたもの（wasm.level-unknown → wasm-level-unknown）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# 受け取った JSON を読めなかった（reason は、JSON を読む部品の文）
wasm-plugins-unreadable = プラグインを読み込めませんでした（{ $reason }）
wasm-change-unreadable = 変更を読み込めませんでした（{ $reason }）
wasm-permissions-unreadable = 権限の並びを読み込めませんでした（{ $reason }）
wasm-intent-unreadable = 操作を読み込めませんでした（{ $reason }）
wasm-files-unreadable = ファイルの一覧を読み込めませんでした（{ $reason }）
wasm-plugin-files-unreadable = プラグインのファイルを読み込めませんでした（{ $reason }）
wasm-request-unreadable = 編集の意図を読み込めませんでした（{ $reason }）

# 選べない知らせの重さ
wasm-level-unknown = 重さ「{ $level }」は選べません

# プラグインのマニフェストを読めなかった（file はファイルの名前、reason はコアの文）
wasm-manifest-refused = { $file }：{ $reason }
wasm-manifest-refused-at = { $file } の { $line } 行目：{ $reason }

# 結果を JSON にできなかった（起きない想定）
wasm-json-failed = 結果を JSON にできませんでした
