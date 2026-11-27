# 図からの操作ができないときに、理由として出す文（crates/modelith-core/src/edit/・write.rs）。
# キーは、コードの「.」を「-」に替えたもの（edit.name-empty → edit-name-empty）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# テキストやファイルの状態で、操作そのものができないとき
edit-unbalanced = テキストに閉じていない括弧（{"{"} {"}"}）やコメントがあるため、図から変更できません。テキストを直してから、もう一度操作してください
edit-in-other-file = この要素はほかのファイルにあります。そのファイルを開いて編集してください
edit-shown-in-other-file = この要素は、ほかのファイルの図に出しているので削除できません。先にそのファイルを開いて、図から外してください
# $file：ファイルのパス
edit-file-missing = ファイル「{ $file }」が見つかりません

# 要素と名前
# $key：要素のキー（図の要素のキー・修飾名）
edit-element-missing = 操作する要素「{ $key }」が見つかりません。テキストが先に変わった可能性があります
edit-element-no-package = 要素を配置するパッケージがありません
edit-name-empty = 名前を入力してください
edit-name-bad-character = 名前に「'」「\」や改行は使えません
edit-name-has-separator = 名前に「::」は使えません（「::」は、パッケージの中の要素を指すときの区切りです）
# $name：付けようとした名前
edit-name-is-keyword = 「{ $name }」はテキストの書き方で使う言葉なので、名前に使えません
edit-name-taken = 「{ $name }」は既に使われています
# $kind：要素の種類（テキストのキーワード。part def など）
edit-kind-not-addable = 「{ $kind }」は、追加できる要素の種類ではありません
edit-package-name-invalid = パッケージ名は、英字か _ で始め、英字・数字・_ だけで付けてください

# 関係
edit-relation-missing = 操作する関係が見つかりません。テキストが先に変わった可能性があります
edit-relation-exists = 同じ関係が既にあります
# $kind：関係の種類（satisfy・flow など）
edit-relation-kind-unknown = 関係の種類「{ $kind }」は扱えません
edit-relation-no-package = 関係を追加するパッケージがありません
edit-flow-no-common-owner = 2 つの部品を両方持つ部品定義がないため、流れを書けません

# 状態遷移の図
edit-state-marker-fixed = 開始と終了の記号は、遷移から決まります。記号を消すときは、つながる遷移を削除してください
edit-transition-into-start = 開始の記号へ向かう遷移は引けません
edit-transition-from-done = 終了の記号から始まる遷移は引けません
edit-transition-second-entry = 開始の記号からの遷移は、本体ごとに 1 つです。行き先を変えるときは、テキストの「entry; then …;」を書き換えてください
edit-transition-done-outside = 終了の記号へは、同じ状態の中の状態からだけ遷移を引けます
edit-transition-exists = 同じ遷移が既にあります。もう 1 つ足すときは、先にテキストで、いまの遷移にきっかけや条件を書いてください
edit-transition-unnamed-state = 名前の無い状態は、図から遷移でつなげません。テキストで名前を付けてから線を引いてください

# アクションの流れの図
edit-succession-marker-fixed = 開始と終了の記号は、順序の線から決まります。記号を消すときは、つながる線を削除してください
edit-succession-into-start = 開始の記号へ向かう順序の線は引けません
edit-succession-from-done = 終了の記号から始まる順序の線は引けません
edit-succession-across-actions = 順序の線は、同じアクションの中の要素どうしにだけ引けます
edit-succession-unnamed = 名前の無い要素は、図から順序の線でつなげません。テキストで名前を付けてから線を引いてください
edit-succession-exists = 同じ順序の線が既にあります

# シーケンス図のメッセージ
edit-message-missing = 操作するメッセージが見つかりません。テキストが先に変わった可能性があります
edit-not-a-message = メッセージではありません
edit-message-at-end = これ以上は動かせません

# フェーズ
edit-phase-undefined = フェーズの定義がありません
edit-phase-inherited-cannot-clear = パッケージから継承しているため、ここでは外せません
edit-phase-already-inherited = すでにパッケージから継承しています
edit-phase-not-chosen = フェーズを選んでください
edit-phase-package-without-body = このファイルの書き方では、フェーズを足せません（最初の package が {"{"} {"}"} で囲まれていません）
edit-phase-no-package = フェーズを書き込むパッケージがありません

# ポート
# $port：ポートの名前
edit-port-missing = ポート「{ $port }」が見つかりません。テキストが先に変わった可能性があります
edit-port-name-invalid = ポート名は英字か _ で始め、英字・数字・_ だけで付けてください
# $direction：ポートの向きとして渡された語（in・out・inout のほか）
edit-port-direction-unknown = ポートの向き「{ $direction }」は扱えません
# $name：付けようとした名前、$owner：ポートを持つ要素の名前
edit-port-name-taken = 「{ $name }」は { $owner } の中で既に使われています

# 作成した図
# $name：図の名前
edit-view-missing = 図「{ $name }」が見つかりません。テキストが先に変わった可能性があります
edit-view-name-not-found = 図「{ $name }」の名前が見つかりません
edit-view-name-empty = 図の名前を入力してください
edit-view-exists = 「{ $name }」という図は既にあります。別の名前にしてください
edit-view-name-is-element = 「{ $name }」という名前の要素が既にあります。図には別の名前を付けてください
edit-view-name-is-package = 「{ $name }」はパッケージの名前なので、図には別の名前を付けてください
# $kind：図の描き方として渡された語（general・actionFlow など）
edit-view-kind-unknown = 図の描き方「{ $kind }」は扱えません
edit-view-target-empty = 図の対象を選んでください
edit-view-no-package = 図を置くパッケージがありません。先にパッケージを作ってください
# $name：要素の名前
edit-view-already-shows = 「{ $name }」は既にこの図にあります
edit-view-shown-together = 「{ $name }」は、ほかの要素とまとめてこの図に入っているため、1 つだけ外すことはできません（テキストの expose で直せます）

# 属性
edit-attribute-name-empty = 属性の名前を入力してください
edit-attribute-text-invalid = 型と値には「;」「{"{"}」「{"}"}」や改行は書けません（型には「=」も書けません）
# $name：属性の名前
edit-attribute-missing = 属性「{ $name }」が見つかりません。テキストが先に変わった可能性があります
edit-attribute-exists = 「{ $name }」という属性は既にあります
edit-attribute-has-body = この属性には中身があるため、テキストで直してください
