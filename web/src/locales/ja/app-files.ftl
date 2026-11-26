# ファイル操作の画面（エクスプローラー・ファイルのメニュー・保存・エクスポート・起動中の表示。日本語）。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。

# ---- どのダイアログでも使うボタンと欄 ----
app-files-button-cancel = やめる
app-files-button-create = 作成
app-files-field-file-name = ファイル名
app-files-field-folder-name = フォルダ名
app-files-quoted-name = 「{ $name }」
app-files-add-mark = ＋

# ---- 開いているファイルの一覧 ----
app-files-open-docs-heading = 開いているファイル
app-files-open-docs-empty = 開いているファイルはありません。
app-files-new-file-hint = 新しいファイル
app-files-doc-close-label = 閉じる
app-files-doc-where-download = { $name }（ダウンロードで保存）
app-files-doc-where-draft = 保存先なし（ブラウザに下書き保存）
app-files-preview-hint = 仮に開いています。編集するか、ダブルクリックすると開いたままになります
app-files-dirty-hint = 未保存の変更があります
app-files-stale-hint = 他のアプリで変更されています
app-files-layout-unsaved-hint = 図の配置（要素の位置）を保存する場所がありません。このファイルが入っているフォルダを開くと保存できます
app-files-layout-unsaved-mark = 配置は未保存

# ---- フォルダとプロジェクトの一覧 ----
app-files-folder-heading = フォルダ
app-files-folder-empty = モデルのファイル（.sysml）がありません。
app-files-folder-intro = フォルダを開くと、中の .sysml ファイルを一覧して編集・上書き保存できます。
app-files-folder-open-button = フォルダを開く
app-files-folder-unsupported = このブラウザではフォルダを開けません（Chrome・Edge で使えます）。「ファイルを開く」で読み込み、保存はダウンロードになります。図の配置ファイル（.layout.json）は、モデルと一緒に選ぶと読み込みます。
app-files-folder-title-project = プロジェクト「{ $project }」（フォルダ「{ $folder }」）
app-files-folder-menu-hint = クリックすると、プロジェクトの一覧（切り替え・フォルダを閉じる）を出します
app-files-new-in-folder-hint = このフォルダに新しいファイル
app-files-refresh-hint = 一覧を更新
app-files-project-list = プロジェクトの一覧
app-files-project-menu-open-other = ほかのフォルダを開く…
app-files-project-menu-close = フォルダを閉じる
app-files-project-menu-delete = このフォルダを削除…
app-files-recent-label = { $project }（フォルダ { $folder }）
app-files-recent-open-hint = フォルダ「{ $name }」を開きます
app-files-recent-forget-label = 一覧から外す
app-files-recent-forget-hint = 一覧から外す（フォルダの中身には触れません）
app-files-recent-menu-heading = 最近開いたフォルダ
app-files-recent-missing-title = フォルダを開けません
app-files-recent-missing-text = フォルダ「{ $name }」を開けませんでした。移動したか、削除された可能性があります。プロジェクトの一覧から外しますか？ フォルダの中身には触れません。
app-files-recent-missing-keep = そのままにする
app-files-recent-missing-forget = 一覧から外す
app-files-recent-record-too-new = 前回開いたフォルダの記録は、新しい版の Modelith が書いた形のため、この版では使えません。記録は消さずに残します。フォルダは「フォルダを開く」から開いてください
app-files-open-failed = 開けませんでした
app-files-open-folder-failed = フォルダを開けませんでした
app-files-folder-permission-denied = フォルダを開く許可が得られませんでした
app-files-not-in-folder = 「{ $path }」が見つかりません。フォルダの一覧を更新してください

# ---- 開いているフォルダの削除 ----
app-files-delete-folder-title = フォルダを削除
app-files-delete-folder-ask = フォルダ「{ $name }」を、中のすべてのファイルごとパソコンから削除しますか？ モデルのファイル以外（画像・文書など）も消えます。
app-files-delete-folder-next = 削除に進む
app-files-delete-folder-confirm-title = 本当に削除しますか
app-files-delete-folder-confirm-text = 確かめのため、削除するフォルダの名前「{ $name }」を入力してください。
app-files-delete-folder-confirm-button = 削除する
app-files-delete-folder-confirm-field = フォルダの名前
app-files-delete-folder-name-mismatch = フォルダの名前が合わないので、削除しませんでした
app-files-delete-folder-failed = フォルダを削除できませんでした
app-files-delete-folder-done = フォルダ「{ $name }」を削除しました

# ---- プロジェクトにする・プロジェクトの設定 ----
app-files-make-project-button = プロジェクトにする
app-files-make-project-hint = プロジェクト名やプラグインなどの設定を、チームで共有できるようにします（設定ファイル { $file } を作成します）
app-files-make-project-title = プロジェクトにする
app-files-make-project-text = フォルダ「{ $folder }」をプロジェクトにします。プロジェクト名を入力してください。チームで共有する設定ファイル（{ $file }）を、フォルダの直下に作成します。
app-files-make-project-field = プロジェクト名
app-files-make-project-done = フォルダ「{ $folder }」を、プロジェクト「{ $name }」にしました
app-files-make-project-failed = プロジェクトにできませんでした
app-files-project-error = プロジェクトの設定（modelith.json）を読み込めません。{ $line } 行目 { $column } 文字目：{ $message }
app-files-project-warning = プロジェクトの設定（modelith.json）の { $line } 行目 { $column } 文字目：{ $message }
app-files-project-more = （ほかに { $count } 件）
app-files-problem-counts = エラー { $errors } 件・警告 { $warnings } 件

# ---- 新しいファイル・新しいフォルダ ----
app-files-new-file-title = 新しいファイル
app-files-new-file-path-text = ファイル名を入力してください。フォルダの中のフォルダに作るときは「models/a.sysml」のように書けます。
app-files-new-file-in-text = フォルダ「{ $dir }」に作るファイルの名前を入力してください。
app-files-new-file-top-text = ファイルの名前を入力してください。
app-files-new-folder-title = 新しいフォルダ
app-files-new-folder-in-text = フォルダ「{ $dir }」に作るフォルダの名前を入力してください。
app-files-new-folder-top-text = フォルダの名前を入力してください。
app-files-model-extension-required = ファイル名の最後は .sysml にしてください（例：model.sysml）
app-files-create-failed = 作成できませんでした

# ---- 保存 ----
app-files-saved = 「{ $name }」を保存しました
app-files-saved-by-download = 「{ $name }」をダウンロードしました
app-files-save-failed = 保存できませんでした：{ $reason }
app-files-save-no-doc = 開いているファイルがありません
app-files-save-as-title = 名前を付けて保存
app-files-save-as-text = フォルダ「{ $folder }」に保存します。ファイル名を入力してください。図の配置（要素の位置）も、同じ名前のファイルに一緒に保存します。
app-files-save-as-button = 保存
app-files-autosave-conflict = 「{ $name }」は他のアプリで変更されたため、自動保存しませんでした。保存（Ctrl+S）で選べます
app-files-autosave-failed = 「{ $name }」を自動保存できませんでした：{ $reason }
app-files-note-drafts = 保存先の無いファイルは、このブラウザに下書き保存されます
app-files-note-download = このブラウザでは、保存はダウンロードになります。図の配置は .layout.json として一緒にダウンロードされ、開くときに 2 つを一緒に選ぶと戻ります

# ---- 図の配置の保存 ----
app-files-layout-locked = { $name }：{ $reason }
app-files-layout-kept-newer = { $reason }。「{ $name }」の図の配置は上書きせず、ファイルの配置を表示しました
app-files-legacy-layout-title = 図の配置を整理します
app-files-legacy-layout-text = 「{ $name }」には、以前の Modelith がモデルのテキストの中に書き込んだ図の配置（要素の位置）があります。配置を別のファイル（{ $layout }）に移して、モデルのテキストからは消しますか？ 図の見た目は変わりません。保存するまでファイルは変わりません。
app-files-legacy-layout-keep = そのままにする
app-files-legacy-layout-move = 移して整理する
app-files-legacy-layout-moved = 保存すると、図の配置が別のファイルに移ります
app-files-layout-home-title = 図の配置を保存する場所
app-files-layout-home-text = 「{ $name }」だけを開いているため、図の配置（要素の位置）を保存できません。このファイルが入っているフォルダを開くと、配置も一緒に保存できるようになります。
app-files-layout-home-later = あとで
app-files-layout-home-open = フォルダを開く
app-files-layout-home-not-in-folder = 選んだフォルダに「{ $name }」がありません。図の配置はまだ保存されていません
app-files-layout-saved-too = 図の配置も保存しました

# ---- 他のアプリでの変更 ----
app-files-conflict-title = ファイルが他で変更されています
app-files-conflict-file-text = 「{ $name }」は開いた後に他のアプリで変更されました。どうしますか？
app-files-conflict-layout-text = 「{ $name }」の図の配置（要素の位置）は開いた後に他のアプリで変更されました。どうしますか？
app-files-conflict-reload = ファイルの内容を読み込む（自分の変更を捨てる）
app-files-conflict-overwrite = 自分の内容で上書きする
app-files-overwritten = 「{ $name }」を上書きしました
app-files-edit-start-title = ファイルが他で変更されています
app-files-edit-start-text = 「{ $name }」は開いた後に他のアプリで変更されています。ファイルの内容を読み込みますか？ 読み込むと、いま入力した変更は消えます。このまま編集すると、保存するときに上書きするかを選べます。
app-files-edit-start-keep = このまま編集する
app-files-edit-start-reload = ファイルの内容を読み込む（いま入力した変更を捨てる）
app-files-reload-failed = 読み込めませんでした
app-files-names-and-more = { $names }ほか { $count } 件
app-files-external-reloaded = 他のアプリで変更された{ $names }を読み直しました
app-files-external-stale = { $names }は他のアプリで変更されています。未保存の変更があるため読み直していません。保存するときに選べます
app-files-external-both = { $reloaded }。{ $stale }

# ---- 閉じる ----
app-files-close-title = 閉じる前に
app-files-close-save-changes = 「{ $name }」の変更を保存しますか？
app-files-close-no-home = 「{ $name }」は保存先がありません。保存しますか？
app-files-close-discard = 保存しない
app-files-close-save = 保存する

# ---- 開いているファイルが無いとき・前回の続き ----
app-files-no-doc-title = 開いているファイルはありません
app-files-resume-title = 前回の続きから始められます
app-files-resume-text = 前回は、フォルダ「{ $folder }」のファイルを開いていました。「前回の続きを開く」を押して、ブラウザの確認でフォルダの編集を許可すると、続きから始めます。
app-files-resume-folder-missing = 前回のフォルダ「{ $name }」を開けませんでした。移動したか、削除された可能性があります
app-files-resume-file-missing = 前回開いていた「{ $name }」が見つかりませんでした
app-files-resume-files-missing = 前回開いていたファイルのうち、{ $count } 個が見つかりませんでした
app-files-nothing-in-file = この図には、このファイルの要素がありません。ほかの図は、タブの「＋」から開けます。

# ---- ファイルの一覧の右クリックのメニュー ----
app-files-menu-open = 開く
app-files-menu-new-file = 新しいファイル…
app-files-menu-new-folder = 新しいフォルダ…
app-files-menu-rename = 名前の変更
app-files-menu-delete = 削除…
app-files-menu-copy-path = パスのコピー
app-files-menu-copy-relative = 相対パスのコピー
app-files-rename-label = 新しい名前
app-files-rename-failed = 名前を変更できませんでした
app-files-delete-title = 削除
app-files-delete-button = 削除
app-files-delete-ask-folder = フォルダ「{ $name }」を中身ごと削除しますか？
app-files-delete-ask-file = 「{ $name }」を削除しますか？
app-files-delete-with-layout = 図の配置のファイル（{ $layout }）も削除します。
app-files-delete-unsaved-lost = 未保存の変更のある{ $names }も閉じ、変更は失われます。
app-files-delete-irreversible = 削除したものは元に戻せません。
app-files-delete-failed = 削除できませんでした
app-files-copy-path-failed = コピーできませんでした。ブラウザがクリップボードへの書き込みを許していません
app-files-copy-path-done = 「{ $path }」をコピーしました

# ---- ほかのファイルの要素への案内 ----
app-files-other-file-title = ほかのファイルの要素です
app-files-other-file-text = この要素は「{ $path }」にあります。図から書き換えられるのは、表示中のファイルの要素だけです。そのファイルを開いて編集してください。
app-files-other-file-close = 閉じる
app-files-other-file-open = そのファイルを開く
app-files-shown-in-file-title = ほかのファイルの図に出しています
app-files-shown-in-file-text = この要素は「{ $path }」の図に出しているので、削除できません。先にそのファイルを開いて、図でこの要素を右クリックし、「この図から外す」を選んでください。

# ---- 図のエクスポート ----
app-files-export-format-svg = SVG 画像（.svg）
app-files-export-format-png = PNG 画像（.png）
app-files-export-format-jpeg = JPEG 画像（.jpg）
app-files-export-format-drawio = draw.io（.drawio）
app-files-export-fallback-name = 図
app-files-export-scale-option = { $scale } 倍
app-files-export-reduced-note = （図が大きいため、倍率を { $scale } 倍に下げました）
app-files-export-downloaded = 「{ $name }」をダウンロードしました
app-files-export-copied = 図を画像としてコピーしました。ほかのアプリに貼り付けられます
app-files-image-failed = 画像を作れませんでした
app-files-image-not-made = 画像を作れませんでした
app-files-copy-image-denied = 画像をコピーできませんでした。ブラウザがクリップボードへの書き込みを許しませんでした。ブラウザの許可を確かめるか、PNG 画像としてエクスポートしてください
app-files-copy-image-unsupported = 画像をコピーできませんでした。このブラウザでは、PNG 画像としてエクスポートしてください

# ---- 起動中の表示と、起動の失敗 ----
app-files-loading = 読み込み中…
app-files-loading-slow = 読み込みに時間がかかっています。通信が遅いか、ブラウザが古い可能性があります。ページを再読み込みしてください
app-files-startup-failed = Modelith を起動できませんでした
app-files-startup-wasm-failed = テキストの解析に必要なモジュール（WebAssembly）を読み込めませんでした。ページを再読み込みしてください。解決しないときは、新しいブラウザ（Chrome・Edge・Firefox・Safari の最新版）で開いてください。
app-files-startup-screen-failed = 画面を組み立てる途中で問題が起きました。保存した設定（パネルの配置・図のタブ）が壊れている可能性があります。設定を初期化して読み直すと、直ることがあります。下書き・前回の続き・プラグインの許可は消えません。
app-files-startup-reset = 保存した設定を初期化して読み直す
