//! プラグインから届いたメッセージを使わなかった理由の文（`locales/ja/plugin.ftl`）が、
//! 辞書に移す前にコアが作っていた日本語の文と同じことを確かめる（ADR-0027 §3。言い回しを変えたら、ここが変わる）。

use modelith_core::message::Message;
use modelith_messages::render;

/// 辞書のテキスト。
const FTL: &str = include_str!("../locales/ja/plugin.ftl");

/// 辞書のキー（行の頭から「 =」の前まで）を、書いた順に並べる。
fn keys() -> Vec<&'static str> {
    FTL.lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key))
        .collect()
}

/// コアが返す文（コードと値）と、辞書に移す前の日本語の文。辞書のキーごとに 1 つ。
fn cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            // 理由は serde_json の文（「`」・「{」を含んでも、そのまま出す）
            Message::new("plugin.message-malformed").arg(
                "reason",
                "unknown variant `shutdown`, expected one of `ready`, `diagnostics` at line 1 column 18 {x}",
            ),
            "形が正しくないメッセージのため、使いませんでした（unknown variant `shutdown`, expected one of `ready`, `diagnostics` at line 1 column 18 {x}）",
        ),
        (
            Message::new("plugin.permission-missing")
                .arg("permission", "edits:propose")
                .arg("type", "proposeEdits"),
            "宣言していない権限（edits:propose）が要るメッセージ（proposeEdits）のため、使いませんでした",
        ),
        (
            Message::new("plugin.edit-outside"),
            "変更案の範囲がテキストの外を指しているため、適用しませんでした",
        ),
        (
            Message::new("plugin.edit-reversed"),
            "変更案の範囲の始まりが終わりより後ろにあるため、適用しませんでした",
        ),
        (
            Message::new("plugin.edits-overlap"),
            "変更案の範囲が重なっているため、適用しませんでした",
        ),
        (
            Message::new("plugin.diagnostic-outside"),
            "診断の範囲がテキストの外を指しているため、使いませんでした",
        ),
    ]
}

#[test]
fn plugin_messages_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn every_plugin_key_is_checked_above() {
    // Arrange（辞書に足した文を、上の一覧に足し忘れない。辞書から消した文を、一覧に残さない）
    let mut checked: Vec<String> = cases()
        .iter()
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    checked.sort();
    checked.dedup();
    // Act
    let mut keys = keys();
    keys.sort_unstable();
    // Assert
    assert_eq!(keys, checked);
}
