# 画面の文言（日本語）。ADR-0027。書き方は docs/development/l10n.md、言葉づかいは docs/development/ui-writing.md。
# キーは「場所-中身」。場所は、文を使うフォルダ（web/src の下）の名前。

## files：ファイルとフォルダの読み書き

files-provider-download = ダウンロード
files-provider-local = このコンピュータ
files-name-empty = 名前を入力してください
files-name-bad-chars = 名前に \ / : * ? " < > | は使えません
files-name-ends-with-dot = 名前の終わりに「.」は使えません
files-name-taken = 同じ場所に「{ $name }」があります
files-name-folder-layout = フォルダには、図の配置のファイルと同じ「.layout.json」で終わる名前を付けられません
files-name-model-extension = モデルのファイルの名前は「.sysml」か「.kerml」で終わるようにしてください
files-conflict = { $path } は読み込んだ後に変更されています
files-not-open = ファイル「{ $name }」は開かれていません
files-folder-not-open = フォルダ「{ $name }」は開かれていません
files-path-outside = パス「{ $path }」は、フォルダの外を指しています
files-no-file-name = ファイル名がありません
files-no-folder-name = フォルダ名がありません
files-already-exists = 「{ $path }」は既にあります
files-not-found = 「{ $path }」が見つかりません
files-nothing-to-remove = 消す場所がありません
files-cannot-remove-folder-itself = このブラウザでは、フォルダそのものを削除できません
files-nothing-to-move = 動かす場所がありません
files-move-into-itself = 「{ $from }」を、その中へは動かせません
files-no-sibling = 「{ $name }」の隣のファイルは扱えません（フォルダを開いてください）
files-too-many = ファイルが多すぎます（{ $max } 件まで）。プラグインのフォルダを選んでください
files-idb-open-failed = IndexedDB を開けません
files-idb-failed = IndexedDB の操作に失敗しました

## workspace：開いている文書とフォルダ

workspace-drafts-locked = 前回の下書きは、新しい版の Modelith が残した形のため、この版では開けません。消さずに残しますが、この版で作った無題の文書は下書きに残りません。手元に残すには「名前を付けて保存」で保存してください
workspace-drafts-unused = 新しい版の Modelith が残した下書きが { $count } 件あり、この版では開けません。消さずに残します
workspace-draft-not-kept-locked = この文書は下書きに残りません（新しい版の Modelith が残した下書きがあるため）。「名前を付けて保存」で保存してください
workspace-draft-not-kept-full = 下書きを保存できません（ブラウザの保存領域がいっぱいです）。「名前を付けて保存」で保存してください
workspace-no-folder = フォルダが開かれていません
workspace-no-storage = 「{ $name }」を読めるストレージがありません
workspace-already-project = このフォルダは既にプロジェクトです（{ $file } があります）
workspace-layout-taken = 図の配置のファイル「{ $layout }」が既にあるため、「{ $to }」にできません。別の名前にしてください
workspace-folder-cannot-remove = このフォルダは削除できません
workspace-folder-cannot-remove-entries = このフォルダでは削除できません
workspace-folder-cannot-write-settings = このフォルダには設定ファイルを書けません
workspace-folder-cannot-create-folder = このフォルダにはフォルダを作れません
workspace-folder-cannot-rename = このフォルダでは名前を変えられません
