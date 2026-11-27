# JSON・YAML を読めなかったときの文（crates/modelith-core/src/read_error.rs）。
# キーは、コードの「.」を「-」に替えたもの（read-error.eof → read-error-eof）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# 読めなかった理由（serde_json・serde_norway の英語の文の代わりに出す）
read-error-eof = 途中で終わっています。閉じる括弧や「"」が足りません
read-error-end-of-stream = 途中で終わっています。閉じる括弧が足りません
read-error-trailing-comma = 最後の項目の後ろに、余計な「,」があります
read-error-trailing-characters = 終わりの後ろに、余計な文字があります
read-error-expected-comma-or-brace = 項目の間の「,」か、閉じる「{"}"}」が足りません
read-error-expected-comma-or-bracket = 項目の間の「,」か、閉じる「]」が足りません
read-error-expected-colon = 項目の名前の後ろに「:」が足りません
read-error-key-not-string = 項目の名前は「"」で囲んでください
read-error-expected-value = 値がありません
read-error-control-character = 文字列の中に、改行などの使えない文字があります
read-error-invalid-escape = 文字列の中の「\」の使い方が違います
read-error-invalid-type = 値の種類が違います
read-error-invalid-length = 値の数が違います
read-error-duplicate-field = 同じ項目が 2 回書かれています
read-error-mapping-values = 「:」の位置が合っていません
read-error-not-found-expected = 字下げか区切りの記号が合っていません
read-error-bad-token = その位置には書けない文字があります
read-error-unknown = 書き方に誤りがあります
read-error-comment = コメント（// や /* */）は書けません

# 理由を添えて、読めなかったことを伝える文
# $format：書式の名前（JSON・YAML）、$reason：上の理由の文、$place：項目の場所（rules[0].require など）
read-error-format = 書式にエラーがあるため読み込めません（{ $format }：{ $reason }）
read-error-format-at = 書式にエラーがあるため読み込めません（{ $format }：{ $reason }）（場所：{ $place }）
read-error-settings = 設定を読み込めませんでした（{ $reason }）
