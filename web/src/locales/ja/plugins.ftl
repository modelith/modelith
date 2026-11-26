# プラグインを動かす部分（web/src/plugins）の文（日本語）。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。

# 動かしているプラグインの状態
plugins-run-state-checking = 確認中
plugins-run-state-asking = 許可の確認中
plugins-run-state-starting = 起動中
plugins-run-state-running = 実行中
plugins-run-state-stopped = 停止
plugins-run-state-failed = エラーあり
plugins-run-state-denied = 許可されていません

# メニューの項目
plugins-menu-commands = プラグインのコマンド
plugins-menu-import = プラグインでインポート
plugins-menu-export = プラグインでエクスポート
plugins-command-tooltip = プラグイン「{ $name }」のコマンド
plugins-import-tooltip = プラグイン「{ $name }」で、ファイル（{ $accept }）をインポートして新しいファイルとして開きます
plugins-import-tooltip-any = プラグイン「{ $name }」で、ファイル（すべて）をインポートして新しいファイルとして開きます
plugins-export-tooltip = プラグイン「{ $name }」で、モデル（作成した図を表示中なら、その図）を { $extension } のファイルにエクスポートしてダウンロードします

# 権限と、実行の許可
plugins-permission-model-read = 解析したモデル（要素と関係）を受け取り、問題一覧に結果を出す
plugins-permission-edits-propose = モデルのテキストを変更する（変更は元に戻せます）
plugins-permission-network = インターネットなど外部と通信する
plugins-permission-storage = このブラウザに、プラグイン用のデータを保存する
plugins-permission-line = { $words }（{ $permission }）
plugins-permission-none = 追加の権限はありません
plugins-permission-separator = 、
plugins-network-warning = このプラグインは、あなたのモデルを外部に送信できます。提供元を信頼できる場合だけ許可してください。
plugins-trust-title = プラグインの実行の許可
plugins-trust-first = プラグイン「{ $name }」（作者：{ $author }、ID：{ $id }、バージョン { $version }）を初めて実行します。
plugins-trust-permissions = プラグイン「{ $name }」（作者：{ $author }、ID：{ $id }、バージョン { $version }）の使う権限が、前回許可したときより増えました（増えた権限：{ $added }）。
plugins-trust-changed = 外部と通信できるプラグイン「{ $name }」（作者：{ $author }、ID：{ $id }、バージョン { $version }）のバージョンかファイルが、前回許可したときから変わりました。
plugins-trust-author-unknown = 記載なし
plugins-trust-body = このプラグインはプログラムを含みます。アプリとは切り離された場所で動き、開いているモデルのテキストを受け取って、次の権限だけを使えます。実行を許可しますか？
plugins-trust-allow = 許可して実行
plugins-trust-deny = 許可しない

# 起動と停止
plugins-sandbox-title = プラグイン
plugins-host-not-ready = プラグインのホストがまだ初期化されていません
plugins-start-failed = プラグインを起動できませんでした：{ $reason }
plugins-insecure-page = このページは安全な接続（https）で開かれていないため、プラグインを確かめられません
plugins-error-inside = プラグインの中でエラーが発生しました：{ $message }
plugins-error-no-detail = （詳細は不明です）
plugins-stop-requested = プラグイン「{ $name }」に停止を指示しました。完全に止まるまで数秒かかることがあります
plugins-halted-toast = プラグイン「{ $name }」に停止を指示しました（届いたメッセージが多すぎるため）

# 届いたメッセージの上限
plugins-intake-queue-full = 届いたメッセージが多すぎるため、使いませんでした（待ちの上限 { $max } 件）
plugins-intake-too-large = 大きすぎるメッセージが届いたため、使いませんでした（上限 { $max } MB）
plugins-intake-halt = 届いたメッセージが多すぎるため、停止を指示しました（使わなかったメッセージ { $dropped } 件）
plugins-dropped-notify = 知らせが多すぎるため、{ $count } 件を表示しませんでした（1 秒に { $perSecond } 件まで）
plugins-dropped-diagnostics = プラグイン「{ $name }」の問題が多すぎるため、{ $dropped } 件を示していません（上限 { $max } 件）
plugins-message-not-json = JSON にできないメッセージが届いたため、使いませんでした
plugins-unrequested = 依頼していない結果（{ $type }）が届いたため、使いませんでした

# 期限までに終わらないとき（一覧の文と、トーストの文）
plugins-stuck-start = 起動が { $seconds } 秒たっても終わりません。「停止」で止められます
plugins-stuck-command = コマンド「{ $title }」が { $seconds } 秒たっても終わりません。「停止」で止められます
plugins-stuck-import = インポート「{ $title }」が { $seconds } 秒たっても終わりません。「停止」で止められます
plugins-stuck-export = エクスポート「{ $title }」が { $seconds } 秒たっても終わりません。「停止」で止められます
plugins-stuck-start-toast = プラグイン「{ $name }」の起動が { $seconds } 秒たっても終わりません。プラグインの一覧の「停止」で止められます
plugins-stuck-command-toast = プラグイン「{ $name }」のコマンド「{ $title }」が { $seconds } 秒たっても終わりません。プラグインの一覧の「停止」で止められます
plugins-stuck-import-toast = プラグイン「{ $name }」のインポート「{ $title }」が { $seconds } 秒たっても終わりません。プラグインの一覧の「停止」で止められます
plugins-stuck-export-toast = プラグイン「{ $name }」のエクスポート「{ $title }」が { $seconds } 秒たっても終わりません。プラグインの一覧の「停止」で止められます

# コマンド・インポート・エクスポート
plugins-no-open-file = 開いているファイルがありません。ファイルを開いてから実行してください
plugins-not-ready-command = プラグインがまだ準備できていないため、コマンドを実行できません
plugins-not-ready-import = プラグインがまだ準備できていないため、インポートできません
plugins-not-ready-export = プラグインがまだ準備できていないため、エクスポートできません
plugins-import-file-too-large = 「{ $fileName }」は大きすぎるためインポートできません（{ $size }。上限 { $max }）
plugins-import-stopped = プラグインが停止したため、インポートできませんでした
plugins-failed-command = コマンド「{ $title }」を実行できませんでした：{ $message }
plugins-failed-import = インポート「{ $title }」を実行できませんでした：{ $message }
plugins-failed-export = エクスポート「{ $title }」を実行できませんでした：{ $message }
plugins-request-failed-toast = プラグイン「{ $name }」の{ $notice }
plugins-imported-too-large = インポートしたテキストが大きすぎます（上限 { $max }）
plugins-exported-not-base64 = エクスポートされたファイルの中身が正しくありません（base64 ではありません）
plugins-exported-too-large = エクスポートされたファイルが大きすぎます（{ $size }。上限 { $max }）
plugins-imported-toast = 「{ $title }」でインポートした結果を、新しいファイル「{ $doc }」として開きました（プラグイン「{ $name }」）。保存するまでファイルには書き込みません
plugins-exported-toast = 「{ $title }」でエクスポートした「{ $fileName }」をダウンロードしました（プラグイン「{ $name }」）
plugins-notify-toast = プラグイン「{ $name }」：{ $message }
plugins-size-bytes = { $bytes } バイト

# テキストの変更
plugins-stale-edit = テキストが変わったため、プラグインの変更を適用しませんでした
plugins-edits-applied-label = 「{ $label }」を適用しました（プラグイン「{ $name }」）
plugins-edits-applied = プラグイン「{ $name }」の変更を適用しました

# プラグイン用の保存場所
plugins-storage-over-limit = プラグイン用の保存場所の上限（{ $limit }）を超えるため、「{ $key }」を保存しませんでした
plugins-storage-refused-toast = プラグイン「{ $name }」：{ $reason }
plugins-storage-failed = プラグイン用の保存場所を使えませんでした：{ $reason }
plugins-store-open-failed = このブラウザの保存場所（IndexedDB）を開けません
plugins-store-failed = このブラウザの保存場所（IndexedDB）の操作に失敗しました
plugins-store-aborted = このブラウザの保存場所（IndexedDB）の操作が中止されました
