//! `modelith` コマンドの文（`locales/ja/cli.ftl`）が、辞書に移す前と同じ日本語の文になることを確かめる。
//! 言い回しを変えたら、ここが変わる。

use modelith_core::Message;
use modelith_messages::render;

/// 辞書のテキスト（キーを数えるために読む）。
const FTL: &str = include_str!("../locales/ja/cli.ftl");

/// まとめの行の文を作る（数は文字で渡す）。
fn summary(files: u32, errors: u32, warnings: u32, information: u32, hints: u32) -> Message {
    Message::new("cli.summary")
        .arg("files", files.to_string())
        .arg("errors", errors.to_string())
        .arg("warnings", warnings.to_string())
        .arg("information", information.to_string())
        .arg("hints", hints.to_string())
}

/// 文と、辞書に移す前に `modelith` コマンドが作っていた日本語の文。辞書のすべてのキーを 1 回以上含める。
fn cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            Message::new("cli.usage"),
            "使い方: modelith check <フォルダ> | modelith --version",
        ),
        (
            Message::new("cli.folder-missing").arg("path", "missing"),
            "フォルダ「missing」が見つかりません",
        ),
        (
            Message::new("cli.project-file-missing").arg("path", "proj/sub"),
            "フォルダ「proj/sub」に modelith.json がありません。プロジェクトのフォルダを指定してください",
        ),
        (
            // 理由が、このコマンドの文
            Message::new("cli.project-file-unreadable")
                .arg_message("reason", Message::new("cli.symlink")),
            "modelith.json を読み込めません（シンボリックリンクは読みません）",
        ),
        (
            // 理由が、OS から届いた文
            Message::new("cli.project-file-unreadable").arg_message(
                "reason",
                Message::verbatim("Permission denied (os error 13)"),
            ),
            "modelith.json を読み込めません（Permission denied (os error 13)）",
        ),
        (
            Message::new("cli.folder-unreadable").arg_message(
                "reason",
                Message::verbatim("Permission denied (os error 13)"),
            ),
            "フォルダの内容を読み込めません（Permission denied (os error 13)）",
        ),
        (
            Message::new("cli.file-unreadable")
                .arg_message("reason", Message::new("cli.file-missing")),
            "ファイルを読み込めません（見つかりません）",
        ),
        (
            Message::new("cli.file-unreadable").arg_message("reason", Message::new("cli.not-utf8")),
            "ファイルを読み込めません（UTF-8 のテキストではありません）",
        ),
        (Message::new("cli.file-missing"), "見つかりません"),
        (
            Message::new("cli.symlink"),
            "シンボリックリンクは読みません",
        ),
        (
            Message::new("cli.not-utf8"),
            "UTF-8 のテキストではありません",
        ),
        (Message::new("cli.severity-error"), "エラー"),
        (Message::new("cli.severity-warning"), "警告"),
        (Message::new("cli.severity-information"), "情報"),
        (Message::new("cli.severity-hint"), "ヒント"),
        (
            // 境界値：すべて 0
            summary(0, 0, 0, 0, 0),
            "ファイル 0 件をチェックしました：エラー 0 件・警告 0 件・情報 0 件・ヒント 0 件",
        ),
        (
            // 値が、それぞれの場所に入る。大きな数に区切りの「,」を入れない（ADR-0027 §2）
            summary(1234567, 1, 2, 3, 4),
            "ファイル 1234567 件をチェックしました：エラー 1 件・警告 2 件・情報 3 件・ヒント 4 件",
        ),
    ]
}

#[test]
fn cli_messages_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn paths_are_put_in_as_plain_characters() {
    // Arrange（異常系：パスが、辞書の書き方に見える文字・空白・日本語・空）
    let odd = Message::new("cli.folder-missing").arg("path", "{ $path }/私の モデル");
    let empty = Message::new("cli.folder-missing").arg("path", "");
    // Act
    let got = [render(&odd), render(&empty)];
    // Assert
    assert_eq!(
        got,
        [
            "フォルダ「{ $path }/私の モデル」が見つかりません",
            "フォルダ「」が見つかりません"
        ]
    );
}

#[test]
fn every_cli_key_is_checked_above() {
    // Arrange（辞書に足した文を、上の `cases` に足し忘れない）
    let mut keys: Vec<String> = FTL
        .lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key.to_owned()))
        .collect();
    keys.sort();
    // Act
    let mut checked: Vec<String> = cases()
        .iter()
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    checked.sort();
    checked.dedup();
    // Assert
    assert_eq!(checked, keys);
    assert_eq!(keys.len(), 14);
}
