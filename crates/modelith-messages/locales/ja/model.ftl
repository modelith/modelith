# モデルを組み立てるときに見つけた問題の文（問題一覧に出る。crates/modelith-core/src/model/）。
# キーは、コードの「.」を「-」に替えたもの（model.type-missing → model-type-missing）。
# 文の終わりの（satisfy）などは、SysML v2 のキーワード。画面はトレースの抜けを、この終わりの形で見分けている。

# 名前で指した相手が見つからない
# $name：書いた名前（修飾名は :: でつないだもの）、$who：それを書いた要素の名前（名前が無ければ種類）
model-type-missing = 型「{ $name }」が見つかりません（{ $who }）
model-general-missing = 引き継ぐ定義「{ $name }」が見つかりません（{ $who }）
# $alias：別名
model-alias-target-missing = 別名「{ $alias }」の指す先「{ $name }」が見つかりません（alias）
model-import-missing = インポートする相手「{ $name }」が見つかりません（import）
model-metadata-about-missing = メタデータを付ける相手「{ $name }」が見つかりません（metadata about）
model-comment-about-missing = メモを付ける相手「{ $name }」が見つかりません（comment about）

# 関係の相手が見つからない
# $name：書いた相手（a.p のような連鎖のこともある）
model-satisfy-end-missing = 「満たす」関係の相手「{ $name }」が見つかりません（satisfy）
model-verify-end-missing = 「検証する」関係の相手「{ $name }」が見つかりません（verify）
model-frame-concern-missing = 扱う関心事「{ $name }」が見つかりません（frame）
model-derive-end-missing = 「導出」関係の相手「{ $name }」が見つかりません（derivation）
model-allocate-end-missing = 「割り当て」関係の相手「{ $name }」が見つかりません（allocate）
model-dependency-end-missing = 「依存」関係の相手「{ $name }」が見つかりません（dependency）
model-bind-end-missing = 「結び付け」の相手「{ $name }」が見つかりません（bind）
model-transition-end-missing = 「遷移」の相手「{ $name }」が見つかりません（transition）
model-succession-end-missing = 「順序」の相手「{ $name }」が見つかりません（succession）
model-succession-flow-end-missing = 「順序付きの流れ」の相手「{ $name }」が見つかりません（succession flow）
# $rel：線のキーワード（connect・flow）
model-line-end-missing = 線の接続先「{ $name }」が見つかりません（{ $rel }）
# $owner：メッセージを書いた要素の名前
model-message-end-not-inside = メッセージの相手「{ $name }」が「{ $owner }」の中にありません（message）
# $port：ポートの名前、$owner：線の端の要素の名前
model-port-missing = ポート「{ $port }」が { $owner } にありません

# 連鎖（a.b.x）の途中の段が見つからない
# $chain：書いた連鎖、$step：見つからない段の名前
model-line-end-step-missing = 線の接続先「{ $chain }」の「{ $step }」が見つかりません（{ $rel }）
model-message-end-step-missing = メッセージの相手「{ $chain }」の「{ $step }」が見つかりません（message）
model-bind-end-step-missing = 「結び付け」の相手「{ $chain }」の「{ $step }」が見つかりません（bind）

# 同じ場所に同じ名前がある
# $name：重なった名前、$place：持ち主の名前（持ち主に名前が無いときは、上の文）
model-name-duplicate = 「{ $name }」という名前は、同じ場所で既に使われています。どちらかの名前を変えてください
model-name-duplicate-in = 「{ $name }」という名前は、「{ $place }」の中で既に使われています。どちらかの名前を変えてください

# シナリオ
model-scenario-order-cyclic = シナリオ「{ $name }」の順序が循環しています（succession）

# まだ扱えない書き方
# $head：書いた文の頭
model-unsupported-syntax = 「{ $head }」は Modelith ではまだ扱えないため、図とツリーに出ません
# $path：インポートの相手、$filter：絞り込みの式
model-import-filter-unsupported = インポート「{ $path }」の絞り込み「{ $filter }」はまだ扱えないため、絞り込まずに取り込みます（import の [ ]・filter）

# 図（view）
# $view：図の名前、$label：図の種類の画面での名前（下の model-view-label-…）、$std：標準ビュー定義の名前
model-view-kind-undrawable = 図「{ $view }」の種類（{ $label }）の描き方はまだ無いため、一般ビューとして描きます（{ $std }）
# $render：表し方の名前
model-view-render-unsupported = 図「{ $view }」の表し方（{ $render }）はまだ扱えないため、図として描きます（render）
model-view-filter-unsupported = 図「{ $view }」の絞り込み「{ $filter }」はまだ扱えないため、絞り込まずに描きます（filter）
model-view-expose-filter-unsupported = 図「{ $view }」の絞り込み「{ $filter }」はまだ扱えないため、絞り込まずに描きます（expose の [ ]）
# $name：出す要素の名前
model-view-expose-missing = 図「{ $view }」に出す要素「{ $name }」が見つかりません（expose）

# 図の種類の、画面での名前（標準ビュー定義ごと。型の無い図は一般ビュー）
model-view-label-general = 一般ビュー
model-view-label-interconnection = 内部ブロック図
model-view-label-action-flow = アクティビティ図
model-view-label-state-transition = 状態遷移図
model-view-label-sequence = シーケンス図
model-view-label-geometry = ジオメトリビュー
model-view-label-grid = グリッドビュー
model-view-label-browser = ブラウザビュー
# 表に無い標準ビュー定義は、その名前をそのまま出す
model-view-label-other = { $name }

# フェーズに沿った要求のトレースの抜け
# $requirement：要求の名前（短い名前があれば <'K3'> 名前）
model-trace-not-expanded = { $requirement }：どの下位の要求にも展開されていません（derivation）
model-trace-no-source = { $requirement }：導出元の上位の要求がありません（derivation）
model-trace-not-satisfied = { $requirement }：この要求を満たす要素がありません（satisfy）
model-trace-not-verified = { $requirement }：この要求を確かめる検証がありません（verify）
