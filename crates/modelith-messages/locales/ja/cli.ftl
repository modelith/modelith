# `modelith` コマンド（crates/modelith-cli）が出す文。
# キーは、コードの「.」を「-」に替えたもの（cli.folder-missing → cli-folder-missing）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# 使い方の 1 行
cli-usage = 使い方: modelith check <フォルダ> | modelith --version

# 検査を始められなかった理由
cli-folder-missing = フォルダ「{ $path }」が見つかりません
cli-project-file-missing = フォルダ「{ $path }」に modelith.json がありません。プロジェクトのフォルダを指定してください
cli-project-file-unreadable = modelith.json を読み込めません（{ $reason }）
cli-folder-unreadable = フォルダの内容を読み込めません（{ $reason }）

# 読めなかったファイル（reason は、下の 3 つか、OS の文）
cli-file-unreadable = ファイルを読み込めません（{ $reason }）
cli-file-missing = 見つかりません
cli-symlink = シンボリックリンクは読みません
cli-not-utf8 = UTF-8 のテキストではありません

# 1 件の行に書く、知らせの重さ
cli-severity-error = エラー
cli-severity-warning = 警告
cli-severity-information = 情報
cli-severity-hint = ヒント

# 最後のまとめの行
cli-summary = ファイル { $files } 件をチェックしました：エラー { $errors } 件・警告 { $warnings } 件・情報 { $information } 件・ヒント { $hints } 件
