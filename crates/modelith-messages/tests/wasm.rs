//! wasm の入口の文（`locales/ja/wasm.ftl`）が、辞書に移す前と同じ日本語の文になることを確かめる。
//! 言い回しを変えたら、ここが変わる。

use modelith_core::Message;
use modelith_messages::render;

/// 辞書のテキスト（キーを数えるために読む）。
const FTL: &str = include_str!("../locales/ja/wasm.ftl");

/// JSON を読む部品（serde_json）の文の例。外から届く文なので、そのまま差し込む。
const SERDE: &str = "expected value at line 1 column 1";

/// 読めなかった文（値は `reason` の 1 つ）を作る。
fn unreadable(code: &'static str) -> Message {
    Message::new(code).arg_message("reason", Message::verbatim(SERDE))
}

/// 文と、辞書に移す前に wasm の入口が作っていた日本語の文。辞書のすべてのキーを 1 回以上含める。
fn cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            unreadable("wasm.plugins-unreadable"),
            "プラグインを読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            unreadable("wasm.change-unreadable"),
            "変更を読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            unreadable("wasm.permissions-unreadable"),
            "権限の並びを読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            unreadable("wasm.intent-unreadable"),
            "操作を読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            unreadable("wasm.files-unreadable"),
            "ファイルの一覧を読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            unreadable("wasm.plugin-files-unreadable"),
            "プラグインのファイルを読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            unreadable("wasm.request-unreadable"),
            "編集の意図を読み込めませんでした（expected value at line 1 column 1）",
        ),
        (
            Message::new("wasm.level-unknown").arg("level", "loud"),
            "重さ「loud」は選べません",
        ),
        (
            // 位置の無い問題（理由は、コアが返す辞書の文）
            Message::new("wasm.manifest-refused")
                .arg("file", "modelith-plugin.json")
                .arg_message("reason", Message::new("read-error.expected-value")),
            "modelith-plugin.json：値がありません",
        ),
        (
            Message::new("wasm.manifest-refused-at")
                .arg("file", "modelith-plugin.json")
                .arg("line", 2.to_string())
                .arg_message("reason", Message::new("read-error.expected-value")),
            "modelith-plugin.json の 2 行目：値がありません",
        ),
        (
            // 境界値：行の数が 2 桁以上・理由が外から届いた文
            Message::new("wasm.manifest-refused-at")
                .arg("file", "modelith-plugin.json")
                .arg("line", 1234.to_string())
                .arg_message("reason", Message::verbatim("理由")),
            "modelith-plugin.json の 1234 行目：理由",
        ),
        (
            Message::new("wasm.json-failed"),
            "結果を JSON にできませんでした",
        ),
    ]
}

#[test]
fn wasm_messages_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn values_are_put_in_as_plain_characters() {
    // Arrange（異常系：値が、辞書の書き方・JSON を壊しうる文字・空）
    let odd = Message::new("wasm.level-unknown").arg("level", "{ $x } \"a\\b\"");
    let empty = Message::new("wasm.level-unknown").arg("level", "");
    // Act
    let got = [render(&odd), render(&empty)];
    // Assert
    assert_eq!(
        got,
        [
            "重さ「{ $x } \"a\\b\"」は選べません",
            "重さ「」は選べません"
        ]
    );
}

#[test]
fn every_wasm_key_is_checked_above() {
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
    assert_eq!(keys.len(), 11);
}
