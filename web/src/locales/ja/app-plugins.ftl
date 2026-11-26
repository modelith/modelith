# プラグインの一覧・追加・削除の画面（web/src/app の plugins.ts と plugin-panel.ts）の文（日本語）。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。

# 追加先と状態
app-plugins-place-project = このプロジェクト
app-plugins-place-browser = このブラウザ
app-plugins-state-ok = 有効
app-plugins-state-error = エラーあり
app-plugins-state-missing = 未追加
app-plugins-state-version = バージョン不一致
app-plugins-state-off = 無効
app-plugins-state-shadowed = プロジェクトを優先
app-plugins-shadowed-notice = このプロジェクトに同じ ID のプラグインがあるため、このプロジェクトではプロジェクトのものを使います（このブラウザのものは使いません）。

# 問題一覧と案内
app-plugins-load-problem-at-line = { $path } の { $line } 行目：{ $message }
app-plugins-load-problem = { $path }：{ $message }
app-plugins-browser-path = このブラウザの { $path }
app-plugins-missing = このプロジェクトで使うプラグイン「{ $id }」が追加されていません。追加しますか？
app-plugins-version-mismatch = このプロジェクトはプラグイン「{ $name }」のバージョン { $wanted } を使いますが、追加されているのはバージョン { $version } です。バージョン { $wanted } を追加しますか？
app-plugins-note-problem = プラグイン「{ $name }」：{ $problem }
app-plugins-finding = { $message }（プラグイン「{ $name }」のルール { $rule }）
app-plugins-diagnostic-code = { $message }（プラグイン「{ $name }」の { $code }）
app-plugins-diagnostic = { $message }（プラグイン「{ $name }」）

# 一覧の最初の案内
app-plugins-intro-unsupported = このブラウザはフォルダを開けないため、プラグインはこのブラウザにだけ追加できます（自分だけが使えます）。プロジェクトに追加してチームや CI と共有するには、Chrome・Edge でモデルのフォルダを開いてください。
app-plugins-intro-no-folder = フォルダを開いていないため、プラグインはこのブラウザにだけ追加できます（自分だけが使えます）。チームや CI と共有するには、「ファイル → フォルダを開く…」でモデルのフォルダを開き、プロジェクトに追加してください。単独で開いたファイルやサンプルは、プロジェクトではありません。
app-plugins-intro-folder = フォルダ「{ $folderName }」はまだプロジェクトではありません。「追加…」でプラグインのフォルダを選び、追加先に「このプロジェクト」を選ぶと、このフォルダをプロジェクトにしてから追加します（設定ファイル modelith.json を作成します）。
app-plugins-intro-broken-project = プロジェクトの設定（modelith.json）にエラーがあるため、プロジェクトのプラグインを使用できません。設定ファイルを修正してから、エクスプローラーの「一覧を更新」（↻）を押してください。このブラウザへの追加はできます。
app-plugins-intro-project = プロジェクト「{ $projectName }」に追加されているプラグインです。チェックルールの結果は、テキストの下の問題一覧に表示されます。
app-plugins-intro-project-empty = プロジェクト「{ $projectName }」にはまだプラグインがありません。「追加…」を押して、プラグインのフォルダを選んでください。

# 「このプロジェクト」に追加できない理由
app-plugins-blocked-unsupported = このブラウザはフォルダを開けないため選べません
app-plugins-blocked-no-folder = フォルダを開いていないため選べません。「ファイル → フォルダを開く…」で開けます
app-plugins-blocked-broken-project = プロジェクトの設定（modelith.json）にエラーがあるため選べません

# 追加の確認
app-plugins-add-title = プラグインを追加
app-plugins-add-wasm-refused = 「{ $name }」は、WebAssembly で動くプラグインです。この種類はまだ追加できません。現在追加できるのは、チェックルールのプラグインと、画面に機能を追加するプラグイン（TypeScript）です
app-plugins-add-lead-author = 「{ $name }」（作者：{ $author }、ID：{ $id }、バージョン { $version }）を追加します。
app-plugins-add-lead = 「{ $name }」（ID：{ $id }、バージョン { $version }）を追加します。
app-plugins-add-description = 説明：{ $description }
app-plugins-add-kind-script = 画面に機能を追加するプラグイン（TypeScript）です。プログラムを含み、下の権限を使います。初めて実行する前に、実行してよいかを確認します。
app-plugins-add-kind-rules = チェックルールのプラグインです。モデルのルールを記述したもので、プログラムは含みません。
app-plugins-add-place-label = 追加先
app-plugins-add-project-name-label = プロジェクト名
app-plugins-add-confirm = 追加する
app-plugins-add-confirm-as-project = プロジェクトにして追加
app-plugins-project-note = { $folder }/ にコピーし、プロジェクトの設定（modelith.json）に登録します。Git で共有すると、チームの全員と CI が同じプラグインを使えます。
app-plugins-project-note-script = { $folder }/ にコピーし、プロジェクトの設定（modelith.json）に登録します。Git で共有すると、チームの全員が同じプラグインを使えます。
app-plugins-project-note-overwrite = 追加済みのプラグインは上書きされます。
app-plugins-project-note-version = プロジェクトの設定ではバージョン { $wanted } が指定されています。追加すると、設定のバージョンを { $version } に変更します。
app-plugins-project-note-new-project = このフォルダはまだプロジェクトではないため、プロジェクトにします（設定ファイル modelith.json をフォルダの直下に作成します）。プロジェクト名を入力してください。
app-plugins-browser-note = このブラウザだけに保存します。どのプロジェクトでも、フォルダを開かなくても使えます。ほかの人や CI（modelith check）とは共有されません。
app-plugins-browser-note-script = このブラウザだけに保存します。どのプロジェクトでも、フォルダを開かなくても使えます。ほかの人とは共有されません。
app-plugins-browser-note-overwrite = このブラウザに追加済みのプラグインは上書きされます。
app-plugins-browser-note-shadowed = このプロジェクトには同じ ID のプラグインがあるため、このプロジェクトではプロジェクトのものを使います。
app-plugins-folder-no-manifest = 選んだフォルダ「{ $folder }」には、プラグインの情報（{ $file }）がありません。プラグインのフォルダを選んでください
app-plugins-describe-refused = 選んだフォルダのプラグインを読み込めません。{ $reason }
app-plugins-no-manifest = プラグインのフォルダに { $file } がありません
app-plugins-file-outside = プラグインのファイル「{ $path }」は、プラグインのフォルダの外を指しています
app-plugins-added-to-project = プラグイン「{ $name }」をこのプロジェクトに追加しました
app-plugins-added-to-browser = プラグイン「{ $name }」をこのブラウザに追加しました
app-plugins-add-failed = プラグインを追加できませんでした
app-plugins-close = 閉じる
app-plugins-cancel = やめる

# 削除の確認
app-plugins-remove-title = プラグインを削除
app-plugins-remove-from-project = プラグイン「{ $name }」をこのプロジェクトから削除しますか？ { $folder }/ のファイルを削除し、プロジェクトの設定（modelith.json）からも登録を解除します。
app-plugins-remove-from-browser = プラグイン「{ $name }」をこのブラウザから削除しますか？
app-plugins-remove-confirm = 削除する
app-plugins-remove-data-label = このプラグインがこのブラウザに保存したデータ（{ $size }）
app-plugins-remove-data-keep = 残す
app-plugins-remove-data-keep-note = 同じプラグインをもう一度追加したときに使えます。
app-plugins-remove-data-delete = 削除する
app-plugins-remove-data-delete-note = このプラグインが保存した設定や記録を消します。元に戻せません。
app-plugins-remove-data-failed = プラグインのデータを削除できませんでした
app-plugins-removed = プラグイン「{ $name }」を削除しました
app-plugins-removed-from-browser = プラグイン「{ $name }」をこのブラウザから削除しました
app-plugins-remove-failed = プラグインを削除できませんでした

# エクスプローラーと一覧の行
app-plugins-button = プラグイン
app-plugins-button-count = プラグイン（{ $count }）
app-plugins-button-tooltip = このプロジェクトに追加したプラグイン（チェックルールなど）の一覧
app-plugins-add-button = 追加…
app-plugins-row-place-tooltip = 追加先
app-plugins-row-version-wanted = { $version }（設定では { $wanted }）
app-plugins-row-details = ID：{ $id }・バージョン：{ $version }
app-plugins-row-details-commands = ID：{ $id }・バージョン：{ $version }・コマンド { $count } 件
app-plugins-row-details-rules = ID：{ $id }・バージョン：{ $version }・ルール { $count } 件
app-plugins-row-permissions-label = 権限
app-plugins-row-enabled = 有効
app-plugins-row-remove = 削除
app-plugins-row-allow = 許可する…
app-plugins-row-stop = 停止
app-plugins-row-start = 開始

# 読み込みと設定の保存
app-plugins-panel-not-ready = プラグインの画面がまだ初期化されていません
app-plugins-project-changed = プロジェクトの設定（modelith.json）が他のアプリで変更されていたため、読み込み直しました。もう一度操作してください
app-plugins-browser-store-unavailable = このブラウザの保存場所を使えないため、このブラウザに追加したプラグインを読み込めません
app-plugins-read-failed = プラグイン「{ $id }」を読み込めませんでした
app-plugins-settings-save-failed = プロジェクトの設定を保存できませんでした
app-plugins-browser-save-failed = このブラウザに保存できませんでした
app-plugins-enabled-done = プラグイン「{ $name }」を有効にしました
app-plugins-disabled-done = プラグイン「{ $name }」を無効にしました。このプラグインのチェック結果は表示されなくなります
