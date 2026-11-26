# 図・パネル・問題一覧と、図からの編集の知らせ（日本語）。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。

# 図のタブ
app-tab-no-target = （未選択）
app-tab-with-phase = { $label }：{ $phase }
app-tab-saved-view = 作成した図「{ $name }」
app-tab-close = タブを閉じる
app-tabs-open-diagram = 図を開く
app-tabs-auto-heading = 自動で描く図
app-tabs-saved-heading = 作成した図
app-tabs-no-saved = 作成した図はまだありません。図のメニューの「新しい図を作成…」で作れます

# パレット（道具）
app-palette-select-hint = 選択：ドラッグで範囲選択（Esc）
app-palette-select = 選択
app-palette-hand-hint = 移動：ドラッグで表示範囲を動かす（中ボタン・スペース＋ドラッグでも可）
app-palette-hand = 移動
app-palette-place-part = 部品を置く
app-palette-place-part-choose = 部品を置く…
app-palette-add-lifeline = ライフラインを追加
app-palette-add-lifeline-choose = ライフラインを追加…
app-palette-new-scenario = 新しいシナリオを作成
app-palette-tool-hint = { $label }（{ $kind }）：押してから図の上をクリックで置く
app-tool-place-usage = 図の上をクリックすると「{ $type }」を部品として置きます（Esc で取消）
app-tool-place-kind = 図の上をクリックすると{ $kind }を置きます（Esc で取消）

# 要素を図で開く（ツリーと右クリックのメニュー）
app-open-saved-view = 作成した図を開く
app-open-in-ibd = 内部ブロック図で開く
app-open-in-seq = シーケンス図で開く
app-open-in-trace = トレーサビリティで開く
app-open-in-control = 制御ループで開く
app-open-in-afv = アクティビティ図で開く
app-open-in-stm = 状態遷移図で開く
app-open-in-structure = ブロック定義図で開く

# モデルのツリー
app-tree-kind-with-phase = { $kind }（{ $phase }）
app-tree-add-to-view = この図に入れる
app-tree-add-as-part = この図に部品として追加
app-tree-add-as-lifeline = この図にライフラインとして追加
app-tree-add = 追加
app-tree-open = 開く
app-tree-show-text = テキストで見る
app-tree-show-text-short = 文
app-tree-message-unnamed = （名前なし）
app-tree-no-match = 一致する要素がありません
app-tree-empty = 要素を追加すると、ここにモデルの構造が表示されます
app-tree-drag-not-allowed = ツリーからのドラッグは、作成した図に要素を入れるときと、内部ブロック図・シーケンス図に部品定義を置くときに使えます

# 図の上のサブバー（対象・フェーズ・トレースの抜け）
app-sub-saved-view-editable-hint = パレットから置くか、ツリーからドラッグすると、この図に入ります。外すときは要素を右クリックします（view の expose・filter）
app-sub-saved-view-fixed-hint = この図に出す要素は、作成した図の設定で決まります（view の expose・filter）
app-sub-saved-view = 作成した図「{ $name }」：
app-sub-saved-view-target = （{ $name }）
app-sub-target-block = 対象ブロック
app-sub-target-scenario = シナリオ
app-sub-target-action = アクション定義
app-sub-target-state = 状態定義
app-sub-phase = フェーズ
app-sub-phase-all = すべて
app-sub-phase-option = { $phase }（{ $count }）
app-sub-phase-start = フェーズ管理を始める
app-sub-gaps = トレースの抜け { $count } 件
app-sub-no-gaps = トレースの抜けなし

# サイドバーの「図」（作成した図の一覧）
app-diagram-row-rename-hint = 名前を変更
app-diagram-row-rename = 名前
app-diagram-row-delete = 削除
app-diagram-list-empty = 作成した図はまだありません。上の「新しい図を作成…」で作れます
app-diagram-menu-open = 開く
app-diagram-menu-rename = 名前を変更
app-diagram-menu-delete = 削除

# 「新しい図を作成」で選ぶ図の種類と、描く対象の呼び方
app-diagram-kind-general = 一般の図（ブロック定義図・要求図）
app-diagram-kind-general-note = 空の図から始めます。モデルのツリーから要素を入れて並べます
app-diagram-kind-interconnection = 内部ブロック図
app-diagram-kind-interconnection-note = ブロックの中の部品と、そのつながりを描きます
app-diagram-kind-action-flow = アクティビティ図
app-diagram-kind-action-flow-note = アクション定義の流れを描きます
app-diagram-kind-state-transition = 状態遷移図
app-diagram-kind-state-transition-note = 状態定義の状態と遷移を描きます
app-diagram-kind-sequence = シーケンス図
app-diagram-kind-sequence-note = シナリオの中のメッセージのやり取りを描きます
app-diagram-def-block = ブロック
app-diagram-def-action = アクション定義
app-diagram-def-state = 状態定義
app-diagram-def-scenario = シナリオ

# 図の作成・名前の変更・削除
app-dialog-cancel = やめる
app-diagram-no-package = 図を置くパッケージがありません。先に要素を追加してパッケージを作ってください
app-diagram-as-is = 今の図のまま（{ $label }）
app-diagram-as-is-note = 表示中の図の要素と配置のまま作成します
app-diagram-next = 次へ
app-diagram-create = 作成
app-diagram-default-name = 新しい図
app-diagram-create-title = 新しい図を作成
app-diagram-create-text = 図の名前と種類を選んでください。作成した図は、サイドバーの「図」と＋メニューの「作成した図」からいつでも開けます。
app-diagram-name-label = 図の名前
app-diagram-kind-label = 図の種類
app-diagram-created = 図「{ $name }」を作成しました
app-diagram-created-empty = 空の図「{ $name }」を作成しました。モデルのツリーから要素を入れてください
app-diagram-created-as-is = 図「{ $name }」を作成しました。サイドバーの「図」からいつでも開けます
app-diagram-target-existing-note = この{ $def }の{ $kind }にします
app-diagram-target-new = 新しい{ $def }を作る
app-diagram-target-new-note = 新しい{ $def }を足して、その{ $kind }にします。名前はあとから変えられます
app-diagram-target-new-confirm = 作って作成
app-diagram-target-title = 図「{ $name }」に描く{ $def }
app-diagram-target-text = { $kind }に描く{ $def }を選んでください。
app-diagram-rename-title = 図の名前を変更
app-diagram-rename-text = 図「{ $name }」の新しい名前を入力してください。
app-diagram-rename-confirm = 変更
app-diagram-renamed = 図の名前を「{ $name }」に変えました
app-diagram-delete-title = 図を削除
app-diagram-delete-text = 図「{ $name }」を削除しますか。図に出していた要素は、モデルに残ります。
app-diagram-delete-confirm = 削除
app-diagram-deleted = 図「{ $name }」を削除しました（モデルの要素は残っています）

# 作成した図に要素を入れる・外す
app-view-cannot-show = 「{ $name }」は、この図には出せません
app-view-already-has = 「{ $name }」は既にこの図にあります
app-view-added = 「{ $name }」をこの図に入れました
app-view-removed = 「{ $name }」をこの図から外しました（モデルには残っています）

# 図からの編集（パッケージの作成・要素・属性・関係・フェーズ・整列）
app-package-create-title = パッケージを作成します
app-package-create-text = 要素はパッケージ（package）の中に配置します。このファイルにはまだパッケージが無いため、名前を付けて作成し、その中に配置します。
app-package-create-confirm = 作成して配置
app-package-name-label = パッケージ名
app-package-name-invalid = パッケージ名は、英字か _ で始め、英字・数字・_ だけで付けてください
app-scenario-added = シナリオ「{ $name }」を追加しました。上のパレットの「ライフラインを追加」から登場する部品を置いてください
app-node-added = { $kind }「{ $name }」を追加しました
app-usage-no-target = 追加先がありません
app-usage-added = { $owner } に部品「{ $name }」（{ $type }）を追加しました
app-attribute-added = 「{ $owner }」に属性「{ $name }」を足しました
app-attribute-changed = 属性「{ $name }」を書き換えました
app-attribute-removed = 属性「{ $name }」を消しました
app-note-deleted = メモを削除しました
app-node-deleted = 「{ $name }」を削除しました
app-note-edge-cannot-delete = メモの線だけは削除できません。メモを選んで削除してください
app-edge-deleted = 関係を削除しました
app-connected-comp = 「{ $from } が { $to } を{ $kind }として持つ」を追加しました
app-connected-satisfy = 「{ $from } が { $to } を満たす」を追加しました
app-connected-verify = 「{ $from } で { $to } を検証する」を追加しました
app-connected-frame = 「{ $from } が関心事 { $to } を扱う」を追加しました
app-connected-derive = 「{ $from } を { $to } から導出する」を追加しました
app-connected-flow = 「{ $from } から { $to } への流れ」を追加しました
app-connected-succession = 「{ $from } の後に { $to }」の順序を追加しました
app-connected-transition = 「{ $from } から { $to } へ」の遷移を追加しました
app-message-added = メッセージ「{ $name }」を追加しました
app-phase-set = { $name } を「{ $phase }」にしました
app-phase-cleared = { $name } のフェーズ指定を外しました
app-phases-initialized = フェーズの定義を追加しました。要素を選んでフェーズを設定できます
app-align-need-two = 2 個以上選ぶと整列できます
app-aligned = { $count } 個を整列しました
app-deleted-many = { $count } 個の定義をテキストから削除しました
app-phase-set-many = { $count } 個を「{ $phase }」にしました
app-selected-count = { $count } 個を選択しました
app-selection-empty = 選択範囲に要素がありません
app-history-undone = 元に戻しました
app-history-redone = やり直しました

# 同期の表示と、テキストエディタ
app-core-not-attached = コアがまだつながっていません
app-sync-reloading = 図を読み込み直しています…
app-sync-gave-up = 図を更新できません。ページを再読み込みしてください
app-core-gave-up = 図を更新できなくなりました。テキストは保存できます。ページを再読み込みしてください
app-sync-done = 同期済み
app-sync-done-with-problems = 同期済み（問題 { $count } 件）
app-sync-editing = 編集中…
app-text-info = SysML v2 テキスト：要素 { $nodes }、関係 { $edges }
app-caret-not-in-view = 「{ $name }」は「{ $diagram }」には出ていません
app-nothing-open-all = 「すべて」の図を開く

# 問題一覧
app-problem-at-line = { $line } 行目：{ $text }
app-problems-count = 問題 { $count } 件
app-problems-levels-hint = 知らせの種類ごとに、エラー・警告・情報・出さないのどれで知らせるかを選ぶ
app-problems-levels = 知らせの重さ…
app-problems-copy-all-hint = 一覧のすべての問題を「ファイル名:行: メッセージ」の形でコピーする
app-problems-copy-all = すべてコピー
app-problems-file-counts = エラー { $errors }・警告 { $warnings }
app-problems-file-more = ほか { $count } 件
app-problems-more = ほかに { $count } 件あります。上の問題を直すと表示します
app-problems-copied = 問題を { $count } 件コピーしました
app-problems-copy-failed = コピーできませんでした。ブラウザがクリップボードへの書き込みを許していません

# 知らせの重さ
app-level-error = エラー
app-level-warning = 警告
app-level-info = 情報
app-level-off = 出さない
app-level-default = 既定（{ $level }）
app-level-default-rule = 既定（ルールに書いた重さ）
app-level-rule = チェックルール：{ $plugin }／{ $rule }
app-level-rule-not-loaded = チェックルール：{ $kind }（読み込んでいません）
app-levels-text = 問題一覧に出す知らせの重さを、種類ごとに選びます。選んだ重さはプロジェクトの設定（modelith.json）に保存し、チームの全員とコマンドラインのチェックに使われます。構文エラーと見つからない型の重さは変えられません。
app-levels-text-no-project = 知らせの重さは、プロジェクトの設定（modelith.json）に保存します。フォルダを開いて「プロジェクトにする」を選ぶと、変えられるようになります。
app-levels-changed = 知らせの重さを変更しました

# 失敗の知らせ（ブラウザのエラーを、利用者に見せる文にする）
app-failure = { $what }：{ $reason }
app-error-unknown = 予期しない問題が起きました。もう一度試してください
app-error-in-use = ファイルが他のアプリで使われているか、書き換えられない状態です。他のアプリを閉じてから、もう一度試してください
app-error-not-allowed = フォルダやファイルを編集する許可がありません。もう一度開いて、ブラウザの確認で許可してください
app-error-not-found = ファイルが見つかりません。移動したか、削除された可能性があります
app-error-quota-exceeded = 保存する場所の空きが足りません。空きを作ってから、もう一度試してください
app-error-type-mismatch = ファイルとフォルダの種類が合いません。同じ名前のファイルやフォルダが無いか確かめてください
app-error-aborted = 操作が取り消されました
app-error-not-readable = ファイルを読み込めません。他のアプリで使われていないか確かめて、もう一度試してください
app-error-save-again = { $reason }。「名前を付けて保存」で保存し直せます
app-unexpected = 予期しない問題が起きました。テキストはそのまま残っています
