# テキスト（SysML v2）を読むときの、書き方の誤りの文（crates/modelith-core/src/syntax/・project/）。
# キーは、コードの「.」を「-」に替えたもの（syntax.name-missing → syntax-name-missing）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# 字句（lexer.rs）
syntax-comment-unclosed = コメント（/* … */）が閉じていません
syntax-quoted-name-unclosed = 引用名（'…'）が閉じていません
syntax-string-unclosed = 文字列（"…"）が閉じていません
syntax-invalid-character = 使えない文字があります

# ブロックと括弧（grammar.rs）
# $max：読み取る入れ子の段の数（256）、$name：ブロックの持ち主の名前
syntax-stray-closing-brace = 対応する「{"{"}」がない「{"}"}」があります
syntax-stray-closing-bracket = 対応する括弧がありません
syntax-too-deep = 入れ子が深すぎるため、この {"{"} … {"}"} の中は読み取りません（{ $max } 段まで）
syntax-block-unclosed = 「{"{"}」に対応する「{"}"}」がありません
syntax-named-block-unclosed = 「{ $name }」のブロックが閉じていません
syntax-paren-unclosed = 括弧が閉じていません

# 要素の書き出し（grammar.rs）
# $word：テキストに書かれた語
syntax-unreadable-symbol = 読めない記号があります
syntax-element-head-missing = 要素の種類や名前がありません
syntax-unknown-kind = 「{ $word }」という種類の要素はありません
syntax-keyword-as-name = 「{ $word }」はテキストの書き方で使う言葉なので、名前に使えません（名前にするなら '{ $word }' と引用符で囲んでください）

# 足りないもの（grammar.rs）
# $token：そこに要る記号やキーワード（;・{"{"}・)・]・=・:=・to・in・then・first・package・language）
syntax-token-missing = 「{ $token }」がありません
syntax-name-missing = 名前がありません
syntax-relationship-target-missing = 関係の相手の名前がありません
syntax-import-target-missing = 対象の名前がありません
syntax-condition-missing = 条件の式がありません
syntax-value-expression-missing = 値の式がありません
syntax-accept-payload-missing = 受けるものがありません
syntax-flow-payload-missing = 流れるものがありません
syntax-language-name-missing = 言語の名前（"…"）がありません
syntax-body-text-missing = 本文（/* … */）がありません

# 式（expr.rs）
# $text：前のトークン（演算子・記号・キーワード）、$before・$after：続けて書かれた 2 つの値、$part：「if」の式に要る部分（?・else）
syntax-value-missing-after = 「{ $text }」の後に値がありません
syntax-name-missing-after = 「{ $text }」の後に名前がありません
syntax-function-name-missing-after = 「{ $text }」の後に関数の名前がありません
syntax-type-name-missing-after = 「{ $text }」の後に型の名前がありません
syntax-operator-missing-between = 「{ $before }」と「{ $after }」の間に演算子がありません
syntax-if-part-missing = 「if」の式に「{ $part }」がありません

# 配置情報を埋め込んだ移行期のコメント（project/mod.rs）
syntax-layout-comment-unreadable = @layout コメントを読み込めません
