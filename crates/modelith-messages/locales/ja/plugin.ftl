# プラグインから届いたメッセージを使わなかった理由の文（crates/modelith-core/src/plugin_host/）。
# キーは、コードの「.」を「-」に替えたもの（plugin.edits-overlap → plugin-edits-overlap）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# メッセージの形と権限
# $reason：読めなかった理由（serde_json の文）、$permission：権限の名前（edits:propose など）、$type：メッセージの種類（proposeEdits など）
plugin-message-malformed = 形が正しくないメッセージのため、使いませんでした（{ $reason }）
plugin-permission-missing = 宣言していない権限（{ $permission }）が要るメッセージ（{ $type }）のため、使いませんでした

# 変更案と診断の範囲
plugin-edit-outside = 変更案の範囲がテキストの外を指しているため、適用しませんでした
plugin-edit-reversed = 変更案の範囲の始まりが終わりより後ろにあるため、適用しませんでした
plugin-edits-overlap = 変更案の範囲が重なっているため、適用しませんでした
plugin-diagnostic-outside = 診断の範囲がテキストの外を指しているため、使いませんでした
