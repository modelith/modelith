# プロジェクトの設定ファイル（modelith.json）の問題の文（crates/modelith-core/src/project_file/）。
# キーは、コードの「.」を「-」に替えたもの（project.empty → project-empty）。
# 文に「{」「}」を書くときは {"{"}・{"}"} と書く（ADR-0027 §2）。

# 読み取れないとき（誤り）
# $id：プラグインの ID、$kind：知らせの種類
project-empty = 中身が空です。少なくとも {"{"} {"}"} と書いてください
project-not-object = 一番外側を {"{"} {"}"} で囲んでください（JSON のオブジェクト）
project-name-not-string = プロジェクト名（name）は、文字列を " " で囲んで書いてください
project-plugins-not-object = プラグインの一覧（plugins）は {"{"} {"}"} で囲んで書いてください
project-plugin-not-object = プラグイン「{ $id }」の設定は {"{"} {"}"} で囲んで書いてください
project-plugin-version-not-string = プラグイン「{ $id }」のバージョン（version）は、文字列を " " で囲んで書いてください（例："0.2.0"）
project-plugin-enabled-not-boolean = プラグイン「{ $id }」の有効・無効（enabled）は true か false で書いてください
project-levels-not-object = 知らせの重さ（levels）は {"{"} {"}"} で囲んで書いてください
project-level-invalid = 知らせ「{ $kind }」の重さは、"error"・"warning"・"info"・"off" のどれかで書いてください

# 読み取れるが、知らせること（注意）
# $key：項目の名前、$id：プラグインの ID、$kind：知らせの種類
project-key-unknown = 不明な項目「{ $key }」があります。削除せずに残します
project-plugin-key-unknown = プラグイン「{ $id }」の設定に、不明な項目「{ $key }」があります。削除せずに残します
project-level-kind-unknown = 知らせの重さ（levels）に、不明な種類「{ $kind }」があります。削除せずに残します
project-level-value-unknown = 知らせ「{ $kind }」の重さは、この版の知らない値です。この版では既定の重さにし、削除せずに残します

# 設定を書き換えられないとき
# $id：プラグインの ID、$line・$column：最初の誤りの行と列、$reason：最初の誤りの文
project-plugin-missing = プロジェクトの設定（modelith.json）に、プラグイン「{ $id }」がありません
project-plugin-id-invalid = プラグインの ID「{ $id }」の形が正しくありません
project-cannot-change = プロジェクトの設定（modelith.json）にエラーがあるため、変更できません。
project-cannot-change-at = プロジェクトの設定（modelith.json）にエラーがあるため、変更できません。{ $line } 行目 { $column } 文字目：{ $reason }
