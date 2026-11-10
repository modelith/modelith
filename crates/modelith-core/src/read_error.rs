//! JSON・YAML の読み取りの部品（serde_json・serde_norway）が返す英語の失敗の文を、画面の言葉にする（Q-4、#243）。
//!
//! 英語の文はそのまま見せず、よくある誤りを日本語の文に置き換える。分からないものは一般的な文にする。

/// よくある誤りの手がかり（英語の文に含まれる語）と、画面に出す文。上から順に当てる。
const REASONS: &[(&str, &str)] = &[
    (
        "EOF while parsing",
        "途中で終わっています。閉じる括弧や「\"」が足りません",
    ),
    (
        "end of stream",
        "途中で終わっています。閉じる括弧が足りません",
    ),
    (
        "trailing comma",
        "最後の項目の後ろに、余計な「,」があります",
    ),
    (
        "trailing characters",
        "終わりの後ろに、余計な文字があります",
    ),
    (
        "expected `,` or `}`",
        "項目の間の「,」か、閉じる「}」が足りません",
    ),
    (
        "expected `,` or `]`",
        "項目の間の「,」か、閉じる「]」が足りません",
    ),
    ("expected `:`", "項目の名前の後ろに「:」が足りません"),
    ("key must be a string", "項目の名前は「\"」で囲んでください"),
    ("expected value", "値がありません"),
    (
        "control character",
        "文字列の中に、改行などの使えない文字があります",
    ),
    ("invalid escape", "文字列の中の「\\」の使い方が違います"),
    ("invalid type", "値の種類が違います"),
    ("invalid length", "値の数が違います"),
    ("duplicate field", "同じ項目が 2 回書かれています"),
    (
        "mapping values are not allowed",
        "「:」の位置が合っていません",
    ),
    (
        "did not find expected",
        "字下げか区切りの記号が合っていません",
    ),
    (
        "cannot start any token",
        "その位置には書けない文字があります",
    ),
];

/// 読み取りの部品の英語の失敗の文から、画面に出す理由の文を選ぶ。
///
/// # 引数
///
/// - `raw`：serde_json・serde_norway の失敗の文（位置を含んでいてよい）
///
/// # 戻り値
///
/// 日本語の理由の文。手がかりが見つからなければ「書き方に誤りがあります」。
///
/// # 例
///
/// ```text
/// read_reason("EOF while parsing an object at line 1 column 1") → "途中で終わっています。閉じる括弧や「"」が足りません"
/// read_reason("trailing comma at line 3 column 1")               → "最後の項目の後ろに、余計な「,」があります"
/// read_reason("something new")                                   → "書き方に誤りがあります"
/// ```
pub(crate) fn read_reason(raw: &str) -> &'static str {
    REASONS
        .iter()
        .find(|(hint, _)| raw.contains(hint))
        .map_or("書き方に誤りがあります", |(_, text)| text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn common_json_errors_get_japanese_reasons() {
        // Arrange（同値分割：途中で終わる・余計な「,」・区切りが無い・値が無い・値の種類）
        let raws = [
            "EOF while parsing an object at line 1 column 1",
            "trailing comma at line 3 column 1",
            "expected `,` or `}` at line 2 column 16",
            "expected value at line 1 column 7",
            "invalid type: string \"1\", expected u32 at line 1 column 9",
        ];
        // Act
        let got: Vec<&str> = raws.iter().map(|r| read_reason(r)).collect();
        // Assert
        assert_eq!(
            got,
            [
                "途中で終わっています。閉じる括弧や「\"」が足りません",
                "最後の項目の後ろに、余計な「,」があります",
                "項目の間の「,」か、閉じる「}」が足りません",
                "値がありません",
                "値の種類が違います",
            ]
        );
    }

    #[test]
    fn unknown_errors_get_a_general_reason_without_english() {
        // Act
        let got = read_reason("some message the parser added later");
        // Assert（異常系：知らない文でも英語を見せない）
        assert_eq!(got, "書き方に誤りがあります");
    }
}
