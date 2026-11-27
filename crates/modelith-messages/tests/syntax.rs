//! 書き方の誤りの文（`locales/ja/syntax.ftl`）が、辞書に移す前にコアが作っていた文と同じであることを確かめる。
//! 言い回しを変えたら、ここが変わる（コアのテストは、コードと値だけを確かめる。ADR-0027 §3）。

use std::collections::BTreeSet;

use modelith_core::message::Message;
use modelith_messages::render;

/// 辞書のテキスト（キーを数えるために読む）。
const DICTIONARY: &str = include_str!("../locales/ja/syntax.ftl");

/// 辞書のすべてのキーについて、コードと値、文にしたものの組を並べる。
fn cases() -> Vec<(Message, &'static str)> {
    let m = Message::new;
    vec![
        // 字句
        (
            m("syntax.comment-unclosed"),
            "コメント（/* … */）が閉じていません",
        ),
        (
            m("syntax.quoted-name-unclosed"),
            "引用名（'…'）が閉じていません",
        ),
        (
            m("syntax.string-unclosed"),
            "文字列（\"…\"）が閉じていません",
        ),
        (m("syntax.invalid-character"), "使えない文字があります"),
        // ブロックと括弧
        (
            m("syntax.stray-closing-brace"),
            "対応する「{」がない「}」があります",
        ),
        (
            m("syntax.stray-closing-bracket"),
            "対応する括弧がありません",
        ),
        (
            m("syntax.too-deep").arg("max", "256"),
            "入れ子が深すぎるため、この { … } の中は読み取りません（256 段まで）",
        ),
        (
            m("syntax.block-unclosed"),
            "「{」に対応する「}」がありません",
        ),
        (
            m("syntax.named-block-unclosed").arg("name", "P"),
            "「P」のブロックが閉じていません",
        ),
        (m("syntax.paren-unclosed"), "括弧が閉じていません"),
        // 要素の書き出し
        (m("syntax.unreadable-symbol"), "読めない記号があります"),
        (
            m("syntax.element-head-missing"),
            "要素の種類や名前がありません",
        ),
        (
            m("syntax.unknown-kind").arg("word", "prt"),
            "「prt」という種類の要素はありません",
        ),
        (
            m("syntax.keyword-as-name").arg("word", "def"),
            "「def」はテキストの書き方で使う言葉なので、名前に使えません（名前にするなら 'def' と引用符で囲んでください）",
        ),
        // 足りないもの
        (
            m("syntax.token-missing").arg("token", ";"),
            "「;」がありません",
        ),
        (m("syntax.name-missing"), "名前がありません"),
        (
            m("syntax.relationship-target-missing"),
            "関係の相手の名前がありません",
        ),
        (m("syntax.import-target-missing"), "対象の名前がありません"),
        (m("syntax.condition-missing"), "条件の式がありません"),
        (m("syntax.value-expression-missing"), "値の式がありません"),
        (m("syntax.accept-payload-missing"), "受けるものがありません"),
        (m("syntax.flow-payload-missing"), "流れるものがありません"),
        (
            m("syntax.language-name-missing"),
            "言語の名前（\"…\"）がありません",
        ),
        (m("syntax.body-text-missing"), "本文（/* … */）がありません"),
        // 式
        (
            m("syntax.value-missing-after").arg("text", "+"),
            "「+」の後に値がありません",
        ),
        (
            m("syntax.name-missing-after").arg("text", "."),
            "「.」の後に名前がありません",
        ),
        (
            m("syntax.function-name-missing-after").arg("text", "->"),
            "「->」の後に関数の名前がありません",
        ),
        (
            m("syntax.type-name-missing-after").arg("text", "as"),
            "「as」の後に型の名前がありません",
        ),
        (
            m("syntax.operator-missing-between")
                .arg("before", "1")
                .arg("after", "2"),
            "「1」と「2」の間に演算子がありません",
        ),
        (
            m("syntax.if-part-missing").arg("part", "else"),
            "「if」の式に「else」がありません",
        ),
        // 配置情報のコメント
        (
            m("syntax.layout-comment-unreadable"),
            "@layout コメントを読み込めません",
        ),
    ]
}

#[test]
fn syntax_messages_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn a_syntax_message_without_its_values_falls_back_to_the_code() {
    // Arrange（異常系：値を取る文に、値を渡さない）
    let with_values: Vec<&'static str> = cases()
        .iter()
        .filter(|(message, _)| !message.args.is_empty())
        .map(|(message, _)| message.code)
        .collect();
    // Act
    let got: Vec<String> = with_values
        .iter()
        .map(|code| render(&Message::new(code)))
        .collect();
    // Assert（辞書の文ではなく、決まった形（コード{}）になる）
    let want: Vec<String> = with_values
        .iter()
        .map(|code| format!("{code}{{}}"))
        .collect();
    assert_eq!(got, want);
}

#[test]
fn every_syntax_key_is_checked_above() {
    // Arrange（辞書に足した文を、上の表に足し忘れない。キーは、行の頭から「 =」の前まで）
    let keys: BTreeSet<String> = DICTIONARY
        .lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key.to_owned()))
        .collect();
    // Act
    let checked: BTreeSet<String> = cases()
        .iter()
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    // Assert（辞書のキーと、表のコードが過不足なく合う）
    assert_eq!(checked, keys);
    assert_eq!(cases().len(), keys.len());
}

#[test]
fn every_missing_token_is_put_in_as_it_is() {
    // Arrange（コアが渡す記号とキーワードのすべて。境界値：辞書の書き方に使う「{」）
    let tokens = [
        ";", "{", ")", "]", "=", ":=", "to", "in", "then", "first", "package", "language",
    ];
    // Act
    let got: Vec<String> = tokens
        .iter()
        .map(|token| render(&Message::new("syntax.token-missing").arg("token", *token)))
        .collect();
    // Assert
    assert_eq!(
        got,
        [
            "「;」がありません",
            "「{」がありません",
            "「)」がありません",
            "「]」がありません",
            "「=」がありません",
            "「:=」がありません",
            "「to」がありません",
            "「in」がありません",
            "「then」がありません",
            "「first」がありません",
            "「package」がありません",
            "「language」がありません",
        ]
    );
}

#[test]
fn tokens_and_names_from_the_text_are_put_in_as_plain_characters() {
    // Arrange（境界値：テキストから来る値が、引用符・括弧・記号・全角の文字を含む）
    let messages = [
        Message::new("syntax.operator-missing-between")
            .arg("before", "'my part'")
            .arg("after", "\"s\""),
        Message::new("syntax.value-missing-after").arg("text", "["),
        Message::new("syntax.value-missing-after").arg("text", "*"),
        Message::new("syntax.if-part-missing").arg("part", "?"),
        Message::new("syntax.named-block-unclosed").arg("name", "'{ $x } 部品'"),
        Message::new("syntax.name-missing-after").arg("text", ""),
    ];
    // Act
    let got = messages.map(|message| render(&message));
    // Assert
    assert_eq!(
        got,
        [
            "「'my part'」と「\"s\"」の間に演算子がありません",
            "「[」の後に値がありません",
            "「*」の後に値がありません",
            "「if」の式に「?」がありません",
            "「'{ $x } 部品'」のブロックが閉じていません",
            "「」の後に名前がありません",
        ]
    );
}
