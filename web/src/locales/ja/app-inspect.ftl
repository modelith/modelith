# インスペクタ・右クリックメニュー・トレースの抜けの案内の言葉（日本語）。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。

# インスペクタのどこでも使うボタンと言葉
app-inspect-show-in-text = テキストで見る
app-inspect-rename = 名前を変更
app-inspect-add-relation = 関係を追加
app-inspect-cancel = やめる
app-inspect-save = 保存
app-inspect-create = 作成
app-inspect-edit = 編集
app-inspect-delete = 削除
app-inspect-delete-confirm = もう一度押して削除
app-inspect-delete-multi = まとめて削除
app-inspect-delete-port = ポートを削除
app-inspect-delete-connection = 接続を削除
app-inspect-delete-note = メモを削除
app-inspect-delete-relation = 関係を削除
app-inspect-unnamed = （名前なし）
app-inspect-none-yet = まだありません
app-inspect-type-none = 型なし
app-inspect-body-label = 本文
app-inspect-list-separator = 、

# 関係を追加するときの案内（接続モード）
app-inspect-connect-from = { $name } から線を引きます
app-inspect-connect-tap = { $target }をタップしてください
app-inspect-connect-target = 接続先の要素
app-inspect-connect-choose = 追加する関係を選択
app-inspect-connect-unnamed-flow = 名前の無い要素は、順序の線でつなげません。テキストで名前を付けてください
app-inspect-connect-unnamed-state = 名前の無い状態は、遷移でつなげません。テキストで名前を付けてください
app-inspect-connect-no-relation = この組み合わせで追加できる関係はありません

# 追加できる関係（接続モードのボタン）
app-inspect-rel-comp = { $kind }として持つ
app-inspect-rel-flow = 信号・物理量を流す（flow）
app-inspect-rel-succession = この後に実行する（順序 succession）
app-inspect-rel-transition = この状態から遷移する（transition）
app-inspect-rel-satisfy = 要求を満たす «satisfy»
app-inspect-rel-verify = 要求を検証する «verify»
app-inspect-rel-frame = 関心事を扱う «frame»
app-inspect-rel-derive = この要求から導出する «derive»
app-inspect-rel-derive-reverse = この要求へ展開する «derive»
app-inspect-rel-satisfy-reverse = この部品で満たす «satisfy»
app-inspect-rel-verify-reverse = この検証で確かめる «verify»
app-inspect-rel-frame-reverse = この要求で扱う «frame»
app-inspect-rel-gap-derive-source = この上位の要求から導出する «derive»
app-inspect-rel-gap-derive-expand = この下位の要求へ展開する «derive»

# 複数を選んだとき
app-inspect-multi-count = { $count } 個を選択中（何もない所をドラッグで範囲選択、Shift＋クリックで増減）
app-inspect-multi-names-more = { $names } ほか{ $count }個
app-inspect-align-left = 左揃え
app-inspect-align-top = 上揃え
app-inspect-align-hspace = 横に等間隔
app-inspect-align-vspace = 縦に等間隔
app-inspect-phase-multi-label = フェーズをまとめて設定
app-inspect-phase-multi-placeholder = フェーズをまとめて設定…

# 接続点とポート
app-inspect-dir-in = 入力
app-inspect-dir-out = 出力
app-inspect-dir-inout = 双方向
app-inspect-param-where = パラメータ（{ $owner }）・{ $dir }
app-inspect-port-where = ポート（{ $owner }）・ドラッグで縁に沿って移動
app-inspect-port-form-title = ポートにする（{ $owner } にポートを追加）
app-inspect-port-name-label = ポート名
app-inspect-port-type-label = ポートの型
app-inspect-anchor-where = 接続点（{ $owner }）・線 { $count } 本・ドラッグで移動
app-inspect-anchor-hint = ここからさらに線を引けます
app-inspect-make-port = ポートにする
app-inspect-remove-anchor = 接続点を外す
app-inspect-port-added = { $owner } にポート「{ $name }」を追加しました
app-inspect-port-added-rewired = { $owner } にポート「{ $name }」を追加しました（つながっていた線を、このポートにつなぎ直しました）
app-inspect-port-dir-set = ポート「{ $name }」を{ $dir }にしました
app-inspect-port-deleted = ポート「{ $name }」を削除しました
app-inspect-anchor-removed = 接続点を外しました（線は自動の位置に戻ります）

# 要素を選んだとき
app-inspect-other-file-where = «{ $kind }» { $path } の要素
app-inspect-open-file = そのファイルを開く
app-inspect-rename-hint = 新しい名前（日本語も使えます。参照もまとめて変更されます）
app-inspect-rename-label = 新しい名前
app-inspect-rename-ok = 変更する
app-inspect-renamed = 「{ $oldName }」を「{ $newName }」に変更しました
app-inspect-renamed-with-uses = 「{ $oldName }」を「{ $newName }」に変更しました。このファイルの中で使っている箇所も変えました
app-inspect-junction-where = 3 つ以上をつなぐ接続（connect） テキスト { $line } 行目
app-inspect-rep-where = 別の言語での表し方（rep） テキスト { $line } 行目
app-inspect-rep-language-label = 言語
app-inspect-note-where = メモ テキスト { $line } 行目
app-inspect-note-about-label = メモを付ける相手
app-inspect-node-where = «{ $kind }» テキスト { $line } 行目・縁の＋から線を引けます
app-inspect-lifeline-where = «{ $kind }» テキスト { $line } 行目・ライフラインから横にドラッグでメッセージを追加
app-inspect-open-type = 型の定義へ
app-inspect-phase-label = フェーズ
app-inspect-phase-none = フェーズなし

# 要素に付けたメモと、別の言語での表し方
app-inspect-note = メモ
app-inspect-note-named = メモ { $name }
app-inspect-rep = 別の言語での表し方（{ $language }）
app-inspect-rep-named = 別の言語での表し方（{ $language }）・{ $name }

# 説明と属性の欄
app-inspect-doc-label = 説明
app-inspect-doc-label-requirement = 要求の文章
app-inspect-doc-edit-hint = { $label }（空にすると消えます）
app-inspect-doc-edit = { $label }を編集
app-inspect-attrs-title = 属性
app-inspect-attr-add = 属性を追加
app-inspect-attr-name-placeholder = 名前
app-inspect-attr-name-label = 属性の名前
app-inspect-attr-type-placeholder = 型（例：Real）
app-inspect-attr-type-label = 属性の型
app-inspect-attr-value-placeholder = 値（例：1500）
app-inspect-attr-value-label = 属性の値

# アクティビティ図と状態遷移図の要素
app-inspect-flow-where = { $label }（{ $kind }） テキスト { $line } 行目・縁の＋から順序の線を引けます
app-inspect-flow-implicit-where = { $label }（{ $kind }）・順序の線から決まる記号です
app-inspect-add-succession = 順序の線を追加
app-inspect-state-what = { $label }（{ $kind }）
app-inspect-state-what-parallel = { $label }（{ $kind }）・並行
app-inspect-state-where = { $what } テキスト { $line } 行目・縁の＋から遷移を引けます
app-inspect-state-start-where = { $what }・最初の遷移から決まる記号です
app-inspect-state-pseudo-where = { $what }・遷移から決まる記号です
app-inspect-add-transition = 遷移を追加
app-inspect-state-actions-label = 振る舞い（entry・do・exit）

# 関係（線）を選んだとき。キーの終わりは線の種類
app-inspect-edge-comp = 部品・特性として持つ
app-inspect-edge-satisfy = 要求を満たす «satisfy»
app-inspect-edge-verify = 要求を検証する «verify»
app-inspect-edge-frame = 関心事を扱う «frame»
app-inspect-edge-flow = 流れ・接続
app-inspect-edge-defined = 型（定義）
app-inspect-edge-derive = 要求の導出 «derive»
app-inspect-edge-specialize = 定義を引き継ぐ（特殊化 :>）
app-inspect-edge-subset = 一部になる（部分集合 subsets）
app-inspect-edge-redefine = 置き換える（再定義 redefines）
app-inspect-edge-reference = 参照する（references）
app-inspect-edge-dependency = 依存する（dependency）
app-inspect-edge-allocate = 割り当てる «allocate»
app-inspect-edge-bind = 値を等しくする（結び付け bind）
app-inspect-edge-connect = 3 つ以上をつなぐ接続（connect）
app-inspect-edge-annotate = メモを付ける（comment about）
app-inspect-edge-succession = 順序（succession）
app-inspect-edge-succession-flow = 順序付きの流れ（succession flow）
app-inspect-edge-transition = 遷移（transition）
app-inspect-edge-with-label = { $name }：{ $label }
app-inspect-reset-shape = 線の形を元に戻す
app-inspect-message-where = メッセージ { $index }／{ $count }：{ $from } → { $to }
app-inspect-message-edit-title = メッセージ { $index } を編集
app-inspect-message-name-label = メッセージ名
app-inspect-message-type-label = アイテムの型
app-inspect-message-up = 上へ
app-inspect-message-down = 下へ
app-inspect-message-edit = 名前・型を編集

# トレースの抜けの案内
app-inspect-gap-title = トレースの抜け
app-inspect-gap-mark-title = トレースの抜け：
app-inspect-gap-guide-label = トレースの抜けの案内
app-inspect-gap-count = { $index } / { $total } 件目
app-inspect-gap-prev = 前の抜けへ
app-inspect-gap-next = 次の抜けへ
app-inspect-gap-resolved-remaining = この要素のトレースの抜けは解消しました（残り { $count } 件）
app-inspect-gap-all-resolved = トレースの抜けはすべて解消しました
app-inspect-gap-expand-lack = この要求は、どの下位の要求にも展開されていません
app-inspect-gap-expand-fix = 「関係を追加」を押して、ここから導き出す下位の要求を選ぶと解消します（derivation）
app-inspect-gap-expand-target = 下位の要求
app-inspect-gap-source-lack = この要求の導出元になる上位の要求がありません
app-inspect-gap-source-fix = 「関係を追加」を押して、導出元の上位の要求を選ぶと解消します（derivation）
app-inspect-gap-source-target = 上位の要求
app-inspect-gap-satisfy-lack = この要求を満たす部品がありません
app-inspect-gap-satisfy-fix = 「関係を追加」を押して、この要求を満たす部品を選ぶと解消します（satisfy）
app-inspect-gap-satisfy-target = 部品
app-inspect-gap-verify-lack = この要求を確かめる検証がありません
app-inspect-gap-verify-fix = 「関係を追加」を押して、検証の要素を選ぶと解消します（verify）
app-inspect-gap-verify-target = 検証の要素
app-inspect-gap-unknown-fix = 「テキストで見る」で、該当の行を確かめてください

# 右クリックメニュー
app-inspect-menu-kind-name = { $kind } { $name }
app-inspect-menu-show-in-text = テキストで見る
app-inspect-menu-rename = 名前を変更
app-inspect-menu-add-relation = 関係を追加…
app-inspect-menu-add-succession = 順序の線を追加…
app-inspect-menu-add-transition = 遷移を追加…
app-inspect-menu-add-to-selection = 選択に追加
app-inspect-menu-phase = フェーズ
app-inspect-menu-phase-current = { $phase }（現在）
app-inspect-menu-remove-from-view = この図から外す
app-inspect-menu-delete-from-model = モデルから削除
app-inspect-menu-delete = 削除
app-inspect-menu-delete-note = メモを削除
app-inspect-menu-delete-relation = 関係を削除
app-inspect-menu-multi-head = { $count } 個を選択中
app-inspect-menu-align-left = 左を揃える
app-inspect-menu-align-top = 上を揃える
app-inspect-menu-align-hspace = 横に等間隔で並べる
app-inspect-menu-align-vspace = 縦に等間隔で並べる
app-inspect-menu-phase-multi = フェーズをまとめて設定
app-inspect-menu-delete-multi = { $count } 個をまとめて削除
app-inspect-menu-message = メッセージ { $index }
app-inspect-menu-message-edit = 名前・型を編集
app-inspect-menu-message-up = 上へ移動
app-inspect-menu-message-down = 下へ移動
app-inspect-menu-port = ポート { $name }
app-inspect-menu-anchor = 接続点
app-inspect-menu-dir = 向き：{ $dir }
app-inspect-menu-dir-current = 向き：{ $dir }（現在）
app-inspect-menu-delete-port = ポートを削除
app-inspect-menu-make-port = ポートにする…
app-inspect-menu-remove-anchor = 接続点を外す
app-inspect-menu-place-part = ここに部品を置く
app-inspect-menu-add-lifeline = ライフラインを追加
app-inspect-menu-add-element = ここに要素を追加
app-inspect-menu-select-all = すべて選択
app-inspect-menu-relayout = この図を並べ直す
app-inspect-menu-relayout-done = この図を並べ直しました
app-inspect-menu-fit = 全体を表示
app-inspect-menu-select-in-view = この図で選択
app-inspect-menu-add-as-part = 開いている図に部品として追加
app-inspect-menu-add-as-lifeline = 開いている図にライフラインとして追加
app-inspect-menu-add-to-view = この図に入れる
app-inspect-menu-rename-diagram = 図の名前を変更
app-inspect-menu-delete-diagram = 図を削除
