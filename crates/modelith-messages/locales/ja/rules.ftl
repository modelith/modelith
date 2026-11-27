# プラグインとルールのファイルを読み込むときの問題の文（crates/modelith-core/src/rules/）。
# キーは、コードの「.」を「-」に替えたもの（rules.duplicate-id → rules-duplicate-id）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# プロジェクトの設定（modelith.json）に書いたプラグインを読み込めないとき
# $id：プラグインの ID、$dir：プラグインを置くフォルダ、$file：マニフェストのファイル名、$reason：読めなかった理由の文
rules-project-plugin-id-invalid = プラグインの ID「{ $id }」の形が正しくありません。英小文字・数字・「-」を「.」で区切って書いてください（例：jp.example.rules）
rules-plugin-not-installed = このプロジェクトで使うプラグイン「{ $id }」が追加されていません。プラグインを { $dir }/{ $id }/ に追加してください（{ $file } が見つかりません）
rules-manifest-unreadable = プラグイン「{ $id }」のマニフェストを読み込めません（{ $reason }）
rules-rule-file-missing = マニフェストに書かれたルールのファイルが見つかりません（contributes.rules）
rules-rule-file-unreadable = ルールのファイルを読み込めません（{ $reason }）
rules-main-file-missing = マニフェストに書かれたプログラムのファイルが見つかりません（main）
rules-main-file-unreadable = プログラムのファイルを読み込めません（{ $reason }）

# マニフェスト（modelith-plugin.json）の中身が使えないとき
# $found：書かれた apiVersion、$supported：対応する apiVersion、$range：engines.modelith に書かれた範囲、$host：この Modelith の版
# $manifest：マニフェストの ID、$project：プロジェクトの設定に書かれた ID、$path：マニフェストに書かれたファイルのパス
rules-api-version-unsupported = 対応していないバージョン（apiVersion「{ $found }」）のプラグインです。この Modelith が対応しているのは「{ $supported }」です
rules-engines-mismatch = このプラグインが動く Modelith の版は「{ $range }」です。この Modelith（{ $host }）では動かしません
rules-engines-range-invalid = 動く Modelith の版の範囲（engines.modelith「{ $range }」）の書き方が正しくありません。「>=0.1.0, <0.3.0」のように、比べる記号と版をカンマで区切って書いてください
rules-wasm-component-unsupported = WebAssembly で動くプラグイン（runtime: wasm-component）には、まだ対応していません
rules-id-mismatch = マニフェストの ID「{ $manifest }」が、プロジェクトに書かれた ID「{ $project }」と違います
rules-main-file-outside = プログラムのファイル「{ $path }」は、プラグインのフォルダの中を、そこからの相対パスで指してください
rules-main-file-required = 画面に機能を追加するプラグイン（runtime: browser）には、プログラムのファイル（main）を書いてください
rules-rule-file-outside = ルールのファイル「{ $path }」は、プラグインのフォルダの中を、そこからの相対パスで指してください

# ルールのファイルの中身が使えないとき
# $id：ルールの ID、$problem：そのルールの問題の文（下の文のどれか）
rules-duplicate-id = ルールの ID「{ $id }」が重複しています。プラグインの中で 1 つにしてください
rules-in-rule = ルール「{ $id }」：{ $problem }

# ルール 1 つの問題（rules-in-rule の $problem に入る）
# $kind：書かれた種類、$allowed：指定できる種類の並び（rules-list-join でつないだもの）、$at：書いた場所（require.incoming など）
# $min・$max：ポートの数の下限・上限、$pattern：正規表現、$reason：正規表現の誤りの理由（regex-lite の文）
rules-kinds-empty = ルールを当てる要素の種類（match.kind）が空です。1 つ以上書いてください
rules-kind-unknown = 不明な要素の種類「{ $kind }」です（match.kind）。指定できる種類：{ $allowed }
rules-ports-min-over-max = ポートの数の下限（{ $min }）が上限（{ $max }）より大きいです（{ $at }.ports）
rules-relations-empty = 関係の種類（{ $at }）が空です。1 つ以上書いてください
rules-relation-unknown = 不明な関係の種類「{ $kind }」です（{ $at }）。指定できる種類：{ $allowed }
rules-regex-invalid = 名前の正規表現にエラーがあります（{ $at }「{ $pattern }」：{ $reason }）

# 名前の並びをつなぐ（$first：初めの 1 つ、$rest：残り。残りが 2 つ以上なら、この文を入れ子にしたもの）
rules-list-join = { $first }・{ $rest }

# マニフェストとルールのファイルの、項目と値の誤り（serde の英語の文の代わりに出す）
# $key：項目の名前、$value：書かれた値、$place：項目の場所（rules[0].require など）
rules-field-unknown = 不明な項目「{ $key }」があります
rules-field-unknown-at = 不明な項目「{ $key }」があります（場所：{ $place }）
rules-field-missing = 必要な項目「{ $key }」がありません
rules-field-missing-at = 必要な項目「{ $key }」がありません（場所：{ $place }）
rules-value-not-allowed = 指定できない値「{ $value }」です
rules-value-not-allowed-at = 指定できない値「{ $value }」です（場所：{ $place }）
rules-rule-id-invalid = ルールの ID は、英小文字・数字・「-」で書いてください（例：req-has-satisfier）
rules-plugin-id-invalid = プラグインの ID は、英小文字・数字・「-」を「.」で区切って書いてください（例：jp.example.rules）
