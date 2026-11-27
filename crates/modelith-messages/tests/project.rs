//! プロジェクトの設定ファイルの問題の文（`locales/ja/project.ftl`）が、
//! 辞書に移す前にコアが作っていた日本語の文と同じことを確かめる（ADR-0027 §3。言い回しを変えたら、ここが変わる）。

use modelith_core::message::Message;
use modelith_messages::render;

/// 辞書のテキスト。
const FTL: &str = include_str!("../locales/ja/project.ftl");

/// 辞書のキー（行の頭から「 =」の前まで）を、書いた順に並べる。
fn keys() -> Vec<&'static str> {
    FTL.lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key))
        .collect()
}

/// コアが返す文（コードと値）と、辞書に移す前の日本語の文。辞書のキーごとに 1 つ以上。
fn cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            Message::new("project.empty"),
            "中身が空です。少なくとも { } と書いてください",
        ),
        (
            Message::new("project.not-object"),
            "一番外側を { } で囲んでください（JSON のオブジェクト）",
        ),
        (
            Message::new("project.name-not-string"),
            "プロジェクト名（name）は、文字列を \" \" で囲んで書いてください",
        ),
        (
            Message::new("project.plugins-not-object"),
            "プラグインの一覧（plugins）は { } で囲んで書いてください",
        ),
        (
            Message::new("project.plugin-not-object").arg("id", "a"),
            "プラグイン「a」の設定は { } で囲んで書いてください",
        ),
        (
            Message::new("project.plugin-version-not-string").arg("id", "b"),
            "プラグイン「b」のバージョン（version）は、文字列を \" \" で囲んで書いてください（例：\"0.2.0\"）",
        ),
        (
            Message::new("project.plugin-enabled-not-boolean").arg("id", "b"),
            "プラグイン「b」の有効・無効（enabled）は true か false で書いてください",
        ),
        (
            Message::new("project.levels-not-object"),
            "知らせの重さ（levels）は { } で囲んで書いてください",
        ),
        (
            Message::new("project.level-invalid").arg("kind", "unsupported"),
            "知らせ「unsupported」の重さは、\"error\"・\"warning\"・\"info\"・\"off\" のどれかで書いてください",
        ),
        (
            Message::new("project.key-unknown").arg("key", "rules"),
            "不明な項目「rules」があります。削除せずに残します",
        ),
        (
            Message::new("project.plugin-key-unknown")
                .arg("id", "jp.a")
                .arg("key", "color"),
            "プラグイン「jp.a」の設定に、不明な項目「color」があります。削除せずに残します",
        ),
        (
            Message::new("project.level-kind-unknown").arg("kind", "trace.verfy"),
            "知らせの重さ（levels）に、不明な種類「trace.verfy」があります。削除せずに残します",
        ),
        (
            Message::new("project.level-value-unknown").arg("kind", "trace.verify"),
            "知らせ「trace.verify」の重さは、この版の知らない値です。この版では既定の重さにし、削除せずに残します",
        ),
        (
            Message::new("project.plugin-missing").arg("id", "jp.x"),
            "プロジェクトの設定（modelith.json）に、プラグイン「jp.x」がありません",
        ),
        (
            Message::new("project.plugin-id-invalid").arg("id", "../x"),
            "プラグインの ID「../x」の形が正しくありません",
        ),
        (
            Message::new("project.cannot-change"),
            "プロジェクトの設定（modelith.json）にエラーがあるため、変更できません。",
        ),
        (
            Message::new("project.cannot-change-at")
                .arg("line", "2")
                .arg("column", "3")
                .arg_message("reason", Message::new("project.name-not-string")),
            "プロジェクトの設定（modelith.json）にエラーがあるため、変更できません。2 行目 3 文字目：プロジェクト名（name）は、文字列を \" \" で囲んで書いてください",
        ),
        (
            // 最初の誤りが、書式の誤り（read-error の文）のとき
            Message::new("project.cannot-change-at")
                .arg("line", "1")
                .arg("column", "1")
                .arg_message(
                    "reason",
                    Message::new("read-error.format")
                        .arg("format", "JSON")
                        .arg_message("reason", Message::new("read-error.expected-value")),
                ),
            "プロジェクトの設定（modelith.json）にエラーがあるため、変更できません。1 行目 1 文字目：書式にエラーがあるため読み込めません（JSON：値がありません）",
        ),
    ]
}

#[test]
fn project_messages_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn every_project_key_is_checked_above() {
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
