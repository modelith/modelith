//! JSON・YAML の読み取りの部品（serde_json・serde_norway）が返す英語の失敗の文を、画面の言葉にする（Q-4、#243）。
//!
//! 英語の文はそのまま見せず、よくある誤りを、理由の種類のコードに置き換える。分からないものは一般的な理由にする。
//! 文は、文言の層の辞書（`crates/modelith-messages/locales/<言語>/read-error.ftl`）にある（ADR-0027 §3）。

use crate::Message;

/// よくある誤りの手がかり（英語の文に含まれる語）と、理由の種類のコード。上から順に当てる。
const REASONS: &[(&str, &str)] = &[
    ("EOF while parsing", "read-error.eof"),
    ("end of stream", "read-error.end-of-stream"),
    ("trailing comma", "read-error.trailing-comma"),
    ("trailing characters", "read-error.trailing-characters"),
    ("expected `,` or `}`", "read-error.expected-comma-or-brace"),
    (
        "expected `,` or `]`",
        "read-error.expected-comma-or-bracket",
    ),
    ("expected `:`", "read-error.expected-colon"),
    ("key must be a string", "read-error.key-not-string"),
    ("expected value", "read-error.expected-value"),
    ("control character", "read-error.control-character"),
    ("invalid escape", "read-error.invalid-escape"),
    ("invalid type", "read-error.invalid-type"),
    ("invalid length", "read-error.invalid-length"),
    ("duplicate field", "read-error.duplicate-field"),
    (
        "mapping values are not allowed",
        "read-error.mapping-values",
    ),
    ("did not find expected", "read-error.not-found-expected"),
    ("cannot start any token", "read-error.bad-token"),
];

/// 手がかりが見つからないときの、一般的な理由（「書き方に誤りがあります」）。
const UNKNOWN: &str = "read-error.unknown";

/// 読み取りの部品の英語の失敗の文から、画面に出す理由を選ぶ。
///
/// # 引数
///
/// - `raw`：serde_json・serde_norway の失敗の文（位置を含んでいてよい）
///
/// # 戻り値
///
/// 理由の文（値の無い `read-error.…`）。手がかりが見つからなければ `read-error.unknown`（「書き方に誤りがあります」）。
///
/// # 例
///
/// ```text
/// read_reason("EOF while parsing an object at line 1 column 1") → read-error.eof            // 途中で終わっています。…
/// read_reason("trailing comma at line 3 column 1")               → read-error.trailing-comma // 最後の項目の後ろに、余計な「,」があります
/// read_reason("something new")                                   → read-error.unknown        // 書き方に誤りがあります
/// ```
pub(crate) fn read_reason(raw: &str) -> Message {
    let code = REASONS
        .iter()
        .find(|(hint, _)| raw.contains(hint))
        .map_or(UNKNOWN, |(_, code)| code);
    Message::new(code)
}

/// JSON にコメントが書かれていたときの理由（「コメント（// や /* */）は書けません」。#266）。
///
/// # 戻り値
///
/// 値の無い `read-error.comment`。
///
/// # 例
///
/// ```text
/// comment_reason() → read-error.comment
/// ```
pub(crate) fn comment_reason() -> Message {
    Message::new("read-error.comment")
}

/// 書式の誤りで読めなかったことを、理由を添えて伝える文を作る。
///
/// # 引数
///
/// - `format`：書式の名前（`JSON`・`YAML`）
/// - `reason`：理由の文（`read_reason`・`comment_reason`）
/// - `place`：誤りのある項目の場所（`rules[0].require` など）。分からなければ None
///
/// # 戻り値
///
/// `read-error.format`（「書式にエラーがあるため読み込めません（JSON：理由）」）。
/// 場所があれば `read-error.format-at`（後ろに「（場所：…）」が付く）。
///
/// # 例
///
/// ```text
/// bad_format("JSON", read-error.eof, None)
///   → read-error.format{format=JSON, reason=read-error.eof{}}
/// bad_format("YAML", read-error.invalid-type, Some("rules[0].require"))
///   → read-error.format-at{format=YAML, reason=read-error.invalid-type{}, place=rules[0].require}
/// ```
pub(crate) fn bad_format(format: &str, reason: Message, place: Option<&str>) -> Message {
    match place {
        None => Message::new("read-error.format")
            .arg("format", format)
            .arg_message("reason", reason),
        Some(place) => Message::new("read-error.format-at")
            .arg("format", format)
            .arg_message("reason", reason)
            .arg("place", place),
    }
}

/// 設定を読めなかったことを、理由を添えて伝える文を作る。
///
/// # 引数
///
/// - `reason`：理由の文（`read_reason`）
///
/// # 戻り値
///
/// `read-error.settings`（「設定を読み込めませんでした（理由）」）。
///
/// # 例
///
/// ```text
/// bad_settings(read-error.invalid-type) → read-error.settings{reason=read-error.invalid-type{}}
/// ```
pub(crate) fn bad_settings(reason: Message) -> Message {
    Message::new("read-error.settings").arg_message("reason", reason)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::Arg;

    #[test]
    fn common_json_errors_get_their_reason_codes() {
        // Arrange（同値分割：途中で終わる・余計な「,」・区切りが無い・値が無い・値の種類）
        let raws = [
            "EOF while parsing an object at line 1 column 1",
            "trailing comma at line 3 column 1",
            "expected `,` or `}` at line 2 column 16",
            "expected value at line 1 column 7",
            "invalid type: string \"1\", expected u32 at line 1 column 9",
        ];
        // Act
        let got: Vec<Message> = raws.iter().map(|r| read_reason(r)).collect();
        // Assert（文ではなく、コードと値で確かめる。ADR-0027 §3）
        assert_eq!(
            got,
            [
                Message::new("read-error.eof"),
                Message::new("read-error.trailing-comma"),
                Message::new("read-error.expected-comma-or-brace"),
                Message::new("read-error.expected-value"),
                Message::new("read-error.invalid-type"),
            ]
        );
    }

    #[test]
    fn every_hint_gets_its_own_code_without_values() {
        // Act（どの手がかりも、その行のコードになる＝上の行の手がかりに先に当たらない）
        let got: Vec<Message> = REASONS.iter().map(|(hint, _)| read_reason(hint)).collect();
        // Assert
        let want: Vec<Message> = REASONS.iter().map(|(_, code)| Message::new(code)).collect();
        assert_eq!(got, want);
    }

    #[test]
    fn unknown_errors_get_a_general_reason_without_english() {
        // Act
        let got = read_reason("some message the parser added later");
        // Assert（異常系：知らない文でも英語を値に入れない）
        assert_eq!(got, Message::new("read-error.unknown"));
    }

    #[test]
    fn an_empty_error_gets_the_general_reason() {
        // Act（境界値：空の文）
        let got = read_reason("");
        // Assert
        assert_eq!(got, Message::new("read-error.unknown"));
    }

    #[test]
    fn bad_format_carries_the_format_and_the_reason() {
        // Act
        let got = bad_format("JSON", read_reason("expected value"), None);
        // Assert
        assert_eq!(got.code, "read-error.format");
        assert_eq!(
            got.args,
            [
                ("format", Arg::Text("JSON".to_owned())),
                (
                    "reason",
                    Arg::Message(Message::new("read-error.expected-value"))
                ),
            ]
        );
    }

    #[test]
    fn bad_format_with_a_place_uses_the_code_that_shows_it() {
        // Act
        let got = bad_format("YAML", comment_reason(), Some("rules[0].require"));
        // Assert
        assert_eq!(got.code, "read-error.format-at");
        assert_eq!(
            got.args,
            [
                ("format", Arg::Text("YAML".to_owned())),
                ("reason", Arg::Message(Message::new("read-error.comment"))),
                ("place", Arg::Text("rules[0].require".to_owned())),
            ]
        );
    }

    #[test]
    fn bad_settings_carries_the_reason() {
        // Act
        let got = bad_settings(read_reason("invalid type: x"));
        // Assert
        assert_eq!(got.code, "read-error.settings");
        assert_eq!(
            got.args,
            [(
                "reason",
                Arg::Message(Message::new("read-error.invalid-type"))
            )]
        );
    }
}
