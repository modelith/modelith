# 図の描画と、図の言葉（日本語）。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。

# 要素の種類の、画面での名前（キーの終わりは SysML v2 のキーワード）
render-kind-part-def = 部品定義
render-kind-part = 部品
render-kind-attribute-def = 属性定義
render-kind-attribute = 属性
render-kind-port-def = ポート定義
render-kind-port = ポート
render-kind-item-def = アイテム定義
render-kind-item = アイテム
render-kind-requirement-def = 要求
render-kind-requirement = 要求
render-kind-concern-def = 関心事
render-kind-concern = 関心事
render-kind-verification-def = 検証
render-kind-verification = 検証
render-kind-analysis-def = 解析
render-kind-analysis = 解析
render-kind-constraint-def = 制約定義
render-kind-constraint = 制約
render-kind-calc-def = 計算定義
render-kind-calc = 計算
render-kind-state-def = 状態定義
render-kind-state = 状態
render-kind-action-def = アクション定義
render-kind-action = アクション
render-kind-exhibit-state = 状態
render-kind-perform-action = アクション
render-kind-occurrence-def = シナリオ
render-kind-occurrence = 出来事
render-kind-interface-def = インタフェース定義
render-kind-connection-def = 接続定義
render-kind-allocation-def = 割り当て定義
render-kind-allocation = 割り当て
render-kind-connection = 接続
render-kind-binding = 結び付け
render-kind-flow-def = 流れの定義
render-kind-flow = 流れ
render-kind-use-case-def = ユースケース定義
render-kind-enum-def = 列挙定義
render-kind-metadata-def = メタデータ定義
render-kind-view-def = 図の定義
render-kind-view = 作成した図
render-kind-package = パッケージ
render-kind-case-def = ケース定義
render-kind-case = ケース
render-kind-actor = アクター
render-kind-include-use-case = 含めるユースケース
render-kind-enum = 列挙
render-kind-event-occurrence = 出来事
render-kind-timeslice = 期間の出来事
render-kind-snapshot = 時点の出来事
render-kind-variant = バリアント
render-kind-viewpoint-def = 視点の定義
render-kind-viewpoint = 視点
render-kind-rendering-def = 描き方の定義
render-kind-rendering = 描き方
render-kind-def = 定義（利用者定義のキーワード）
render-kind-usage = 使用（利用者定義のキーワード）
render-kind-comment = メモ
render-kind-fork = 分岐（並行）
render-kind-join = 合流（並行）
render-kind-decide = 分岐（条件）
render-kind-merge = 合流（条件）
render-kind-send = 送信
render-kind-accept = 受信
render-kind-assign = 代入
render-kind-terminate = 打ち切り
render-kind-if = 条件付きの実行
render-kind-while = 繰り返し
render-kind-loop = 繰り返し
render-kind-for = 要素ごとの繰り返し
render-kind-start = 開始
render-kind-done = 終了
render-kind-succession-flow = 順序付きの流れ

# 図の種類と、その補足
render-v2-view = SysML v2 では { $std }
render-v2-view-drawn = SysML v2 では { $std } で描く図
render-view-hint = { $label }（{ $note }）
render-doc-removed = 「{ $name }」の{ $label }を消しました
render-doc-changed = 「{ $name }」の{ $label }を変えました
render-doc-changed-escaped = 「{ $name }」の{ $label }を変えました。「*/」はテキストに書けないため「* /」にしました

# 図の種類の名前と、「〜の図」と呼ぶときの名前
render-view-trace = トレーサビリティ
render-view-trace-diagram = トレーサビリティの図
render-view-structure = ブロック定義図
render-view-structure-diagram = ブロック定義図
render-view-control = 制御ループ
render-view-control-diagram = 制御ループの図
render-view-ibd = 内部ブロック図
render-view-ibd-diagram = 内部ブロック図
render-view-behavior = 振る舞い
render-view-behavior-diagram = 振る舞いの図
render-view-seq = シーケンス図
render-view-seq-diagram = シーケンス図
render-view-afv = アクティビティ図
render-view-afv-diagram = アクティビティ図
render-view-stm = 状態遷移図
render-view-stm-diagram = 状態遷移図
render-view-all = すべて
render-view-all-diagram = すべての図

# 工程（@Phase の値）
render-phase-stakeholder-needs = 利用者要求
render-phase-system-requirements = システム要求
render-phase-architecture = 方式設計
render-phase-verification = 検証
render-phase-inherited = { $phase }（継承）

# 図の中に描く文と、線のつまみのツールチップ
render-unnamed = （名前なし）
render-more-rows = … ほか { $count } 行
render-list-separator = ・
render-edge-end-hint = 端を別の縁へ付け替える
render-edge-bend-hint = 動かす・ダブルクリックで消す
render-edge-mid-hint = 動かして曲がり角を足す

# 図に出すものが無いときの案内
render-empty-ibd = 中に部品を持つ部品定義がまだありません。「ブロック定義図」で、部品定義から別の部品定義へ線を引き、「部品として持つ」を選ぶと作れます。
render-empty-seq = シナリオがまだありません。上のパレットの「シナリオ」から作れます。
render-empty-afv = アクション定義がまだありません。「振る舞い」の図のパレットの「アクション定義」から作れます。
render-empty-afv-actions = 「{ $name }」には、まだアクションがありません。テキストに action や順序（first … then）を書くと、ここに流れが出ます。
render-empty-stm = 状態定義がまだありません。「振る舞い」の図のパレットの「状態定義」から作れます。
render-empty-stm-states = 「{ $name }」には、まだ状態がありません。テキストに state や遷移（transition）を書くと、ここに図が出ます。
render-empty-view-gone = 作成した図「{ $name }」は、モデルから消えています。
render-empty-view-no-ibd = 図「{ $name }」に、中に部品を持つ部品定義が含まれていません。
render-empty-view-no-afv = 図「{ $name }」に、アクション定義が含まれていません。
render-empty-view-no-stm = 図「{ $name }」に、状態定義が含まれていません。
render-empty-view-no-seq = 図「{ $name }」に、シナリオが含まれていません。
render-empty-view = 図「{ $name }」に、図に出せる要素がありません。
render-empty-view-in-packages = 図「{ $name }」に、パッケージ（{ $packages }）の中に、図に出せる要素がありません。

# 配置ファイル（.layout.json）
render-layout-broken-json = 配置ファイルを読めません（JSON の形が壊れています）
render-layout-wrong-shape = 配置ファイルの形が違います
render-layout-wrong-format = 配置ファイルの形式の書き方が違います
render-layout-unknown-format = 配置ファイルの形式（{ $format }）に対応していません
render-layout-locked = { $reason }。ファイルを守るため、この版では図の配置を保存しません
render-layout-locked-features = 配置ファイルに、新しい版の Modelith で使った機能（{ $features }）が入っています。ファイルを守るため、この版では図の配置を保存しません
render-layout-not-saved-note = 。図の配置は、ファイルを守るため保存していません
