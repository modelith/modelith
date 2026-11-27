//! 文言の層。コアが返す「種類のコードと値」（`modelith_core::message::Message`）を、辞書で文にする（ADR-0027 §3）。
//!
//! 依存の向きは「入口（wasm・CLI）→ この crate → コア」だけ。入口が
//! `modelith_core::message::set_renderer(modelith_messages::render)` でつなぐ。
//!
//! 辞書は Fluent（`locales/<言語>/<場所>.ftl`）で、公式の実装（`fluent-bundle`）で読む。
//! キーは、コードの `.` を `-` に替えたもの（`read-error.eof` → `read-error-eof`）で、ファイルの名前で始める。
//! 今は日本語の辞書だけを持つ（英語は 0.4.0。ADR-0027 §1）。

use fluent_bundle::{FluentArgs, FluentBundle, FluentResource, FluentValue};
use modelith_core::message::{Arg, Message, VERBATIM, fallback_text};
use unic_langid::LanguageIdentifier;

/// 日本語の辞書（場所の名前と、Fluent のテキスト）。キーは場所の名前で始める。
const JA: &[(&str, &str)] = &[
    ("read-error", include_str!("../locales/ja/read-error.ftl")),
    ("syntax", include_str!("../locales/ja/syntax.ftl")),
    ("edit", include_str!("../locales/ja/edit.ftl")),
    ("model", include_str!("../locales/ja/model.ftl")),
    ("rules", include_str!("../locales/ja/rules.ftl")),
    ("project", include_str!("../locales/ja/project.ftl")),
    ("plugin", include_str!("../locales/ja/plugin.ftl")),
    ("wasm", include_str!("../locales/ja/wasm.ftl")),
    ("cli", include_str!("../locales/ja/cli.ftl")),
];

thread_local! {
    /// 日本語の辞書を読んだもの。`FluentBundle` はスレッドをまたげないので、スレッドごとに、初めて使うときに作る。
    static BUNDLE: FluentBundle<FluentResource> = bundle("ja", JA).0;
}

/// 辞書のテキストを読み、文にする部品（`FluentBundle`）を作る。
///
/// # 引数
///
/// - `language`：言語の名前（`ja` など）。読めなければ、言語を決めない（複数形の選び分けは既定の形になる）
/// - `sources`：場所の名前と、Fluent のテキスト
///
/// # 戻り値
///
/// 文にする部品と、読むときに見つけた誤り（書き方の誤り・同じキーの重なり。「場所：内容」の形）。
/// 誤りのある文だけを除き、読めた文は使える。値の前後に見えない記号（U+2068・U+2069）は入れない。
///
/// # 例
///
/// ```text
/// bundle("ja", &[("a", "a-x = 文")])                 → (a-x を持つ部品, [])
/// bundle("ja", &[("a", "a-x = 文\na-x = 別の文")])   → (初めの a-x を持つ部品, ["a：…"])   // 同じキー
/// bundle("ja", &[("a", "= 文")])                     → (空の部品, ["a：…"])               // 書き方の誤り
/// ```
fn bundle(language: &str, sources: &[(&str, &str)]) -> (FluentBundle<FluentResource>, Vec<String>) {
    let languages: Vec<LanguageIdentifier> = language.parse().ok().into_iter().collect();
    let mut bundle = FluentBundle::new(languages);
    bundle.set_use_isolating(false);
    let mut problems = Vec::new();
    for (area, text) in sources {
        let resource = match FluentResource::try_new((*text).to_owned()) {
            Ok(resource) => resource,
            Err((resource, errors)) => {
                problems.extend(errors.iter().map(|e| format!("{area}：{e}")));
                resource
            }
        };
        if let Err(errors) = bundle.add_resource(resource) {
            problems.extend(errors.iter().map(|e| format!("{area}：{e}")));
        }
    }
    (bundle, problems)
}

/// コードを、辞書のキーにする。
///
/// # 引数
///
/// - `code`：種類のコード（`<場所>.<種類>`）
///
/// # 戻り値
///
/// `.` を `-` に替えたもの。
///
/// # 例
///
/// ```text
/// key_of("read-error.eof") → "read-error-eof"
/// key_of("verbatim")       → "verbatim"
/// ```
fn key_of(code: &str) -> String {
    code.replace('.', "-")
}

/// 辞書のキーと値から、文を作る。
///
/// # 引数
///
/// - `bundle`：辞書を読んだ部品
/// - `key`：辞書のキー
/// - `args`：値の名前と、文字にした値。文字のまま差し込む（`{`・`}`・`<b>` などもそのまま出る）
///
/// # 戻り値
///
/// 文。キーが無い・文に値が足りないなど、文にできなければ None。
///
/// # 例
///
/// ```text
/// format(b, "read-error-eof", &[])                                          → Some("途中で終わっています。…")
/// format(b, "read-error-settings", &[("reason", "値がありません")])          → Some("設定を読み込めませんでした（値がありません）")
/// format(b, "read-error-settings", &[])                                     → None   // 値が足りない
/// format(b, "no-such-key", &[])                                             → None
/// ```
fn format(
    bundle: &FluentBundle<FluentResource>,
    key: &str,
    args: &[(&str, &str)],
) -> Option<String> {
    let pattern = bundle.get_message(key)?.value()?;
    let mut values = FluentArgs::new();
    for (name, value) in args {
        values.set(*name, FluentValue::from(*value));
    }
    let mut errors = Vec::new();
    let text = bundle.format_pattern(pattern, Some(&values), &mut errors);
    errors.is_empty().then(|| text.into_owned())
}

/// コアの文を、日本語の辞書で文にする。入口が `modelith_core::message::set_renderer` に渡す。
///
/// # 引数
///
/// - `message`：コアが返した文（種類のコードと値）
///
/// # 戻り値
///
/// 利用者に見せる文。そのまま出す文（`verbatim`）は、その文。中の文（`Arg::Message`）は、先に文にしてから差し込む。
/// 辞書にキーが無い・値が足りないときは、コアと同じ決まった形（`コード{名前=値}`）にする。失敗しない。
///
/// # 例
///
/// ```text
/// render(&Message::verbatim("そのまま"))    → "そのまま"
/// render(&Message::new("read-error.eof"))   → "途中で終わっています。閉じる括弧や「"」が足りません"
/// render(&Message::new("read-error.settings").arg_message("reason", Message::new("read-error.expected-value")))
///   → "設定を読み込めませんでした（値がありません）"
/// render(&Message::new("no.such").arg("name", "X")) → "no.such{name=X}"   // 辞書に無い
/// ```
pub fn render(message: &Message) -> String {
    if let Some(text) = message.verbatim_text() {
        return text.to_owned();
    }
    let texts: Vec<(&str, String)> = message
        .args
        .iter()
        .map(|(name, value)| match value {
            Arg::Text(text) => (*name, text.clone()),
            Arg::Message(inner) => (*name, render(inner)),
        })
        .collect();
    let args: Vec<(&str, &str)> = texts.iter().map(|(n, t)| (*n, t.as_str())).collect();
    BUNDLE
        .with(|bundle| format(bundle, &key_of(message.code), &args))
        .unwrap_or_else(|| message.fallback())
}

/// コードと値を、日本語の辞書で文にする。コードを実行時に受け取る入口のためのもの
/// （同じ辞書と値を Rust と TypeScript の実装に通して比べるテスト。ADR-0027 §6）。
///
/// # 引数
///
/// - `code`：種類のコード（`read-error.eof` など）。辞書のキー（`read-error-eof`）を渡しても同じ
/// - `args`：値の名前と、文字にした値
///
/// # 戻り値
///
/// `render` と同じ文。`verbatim` に値 `text` が 1 つなら、その値。辞書に無ければ `コード{名前=値}`。失敗しない。
///
/// # 例
///
/// ```text
/// render_code("read-error.settings", &[("reason".into(), "値がありません".into())]) → "設定を読み込めませんでした（値がありません）"
/// render_code("verbatim", &[("text".into(), "そのまま".into())])                    → "そのまま"
/// render_code("no.such", &[])                                                       → "no.such{}"
/// ```
pub fn render_code(code: &str, args: &[(String, String)]) -> String {
    let args: Vec<(&str, &str)> = args.iter().map(|(n, v)| (n.as_str(), v.as_str())).collect();
    if let (VERBATIM, [("text", text)]) = (code, args.as_slice()) {
        return (*text).to_owned();
    }
    BUNDLE
        .with(|bundle| format(bundle, &key_of(code), &args))
        .unwrap_or_else(|| fallback_text(code, &args))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 辞書のキー（行の頭から「 =」の前まで）を、場所ごとに並べる。
    fn keys() -> Vec<(&'static str, &'static str)> {
        JA.iter()
            .flat_map(|(area, text)| {
                text.lines()
                    .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
                    .filter_map(|line| line.split_once(" =").map(|(key, _)| (*area, key)))
            })
            .collect()
    }

    // ---- 辞書そのもの ----

    #[test]
    fn dictionary_is_read_without_problems() {
        // Act
        let (_, problems) = bundle("ja", JA);
        // Assert（書き方の誤りも、同じキーの重なりも無い）
        assert_eq!(problems, Vec::<String>::new());
    }

    #[test]
    fn keys_start_with_the_name_of_their_file() {
        // Act
        let wrong: Vec<_> = keys()
            .into_iter()
            .filter(|(area, key)| !key.starts_with(&format!("{area}-")))
            .collect();
        // Assert
        assert_eq!(wrong, []);
    }

    #[test]
    fn keys_use_only_lowercase_letters_digits_and_hyphens() {
        // Act（ADR-0027 §2 のキーの決まり）
        let wrong: Vec<_> = keys()
            .into_iter()
            .filter(|(_, key)| {
                !key.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
            })
            .collect();
        // Assert
        assert_eq!(wrong, []);
    }

    #[test]
    fn every_key_renders_without_its_values_only_if_it_takes_none() {
        // Arrange（値を取らない文は、値なしで文になる。値を取る文は、値なしでは決まった形に戻る）
        let with_values = [
            "read-error-format",
            "read-error-format-at",
            "read-error-settings",
        ];
        // Act
        let failed: Vec<&str> = keys()
            .into_iter()
            .filter(|(area, _)| *area == "read-error")
            .map(|(_, key)| key)
            .filter(|key| BUNDLE.with(|b| format(b, key, &[])).is_none())
            .collect();
        // Assert
        assert_eq!(failed, with_values);
    }

    #[test]
    fn bundle_reports_syntax_errors_and_duplicate_keys() {
        // Arrange（異常系：書き方の誤り・同じキーが 2 回）
        let broken = [("a", "= 文")];
        let twice = [("a", "a-x = 文\na-x = 別の文")];
        // Act
        let got = [bundle("ja", &broken).1.len(), bundle("ja", &twice).1.len()];
        // Assert
        assert_eq!(got, [1, 1]);
    }

    #[test]
    fn bundle_with_an_unknown_language_name_still_formats() {
        // Arrange（異常系：言語の名前として読めない）
        let (b, problems) = bundle("not a language", &[("a", "a-x = 文 { $v }")]);
        // Act
        let text = format(&b, "a-x", &[("v", "1")]);
        // Assert
        assert_eq!(problems, Vec::<String>::new());
        assert_eq!(text.as_deref(), Some("文 1"));
    }

    // ---- 文にする ----

    #[test]
    fn verbatim_is_rendered_as_its_text() {
        // Arrange（境界値：空の文と、辞書の書き方に見える文）
        let messages = [
            Message::verbatim(""),
            Message::verbatim("{ $name } = そのまま"),
        ];
        // Act
        let got = messages.map(|m| render(&m));
        // Assert
        assert_eq!(got, ["", "{ $name } = そのまま"]);
    }

    #[test]
    fn a_key_with_a_value_is_rendered_from_the_dictionary() {
        // Arrange
        let message = Message::new("read-error.settings").arg("reason", "理由");
        // Act
        let text = render(&message);
        // Assert
        assert_eq!(text, "設定を読み込めませんでした（理由）");
    }

    #[test]
    fn a_nested_message_is_rendered_first_and_put_in_as_text() {
        // Arrange（中の文が、辞書の文と、そのまま出す文）
        let from_dictionary = Message::new("read-error.format")
            .arg("format", "YAML")
            .arg_message("reason", Message::new("read-error.mapping-values"));
        let from_outside = Message::new("read-error.settings")
            .arg_message("reason", Message::verbatim("permission denied"));
        // Act
        let got = [render(&from_dictionary), render(&from_outside)];
        // Assert
        assert_eq!(
            got,
            [
                "書式にエラーがあるため読み込めません（YAML：「:」の位置が合っていません）",
                "設定を読み込めませんでした（permission denied）",
            ]
        );
    }

    #[test]
    fn values_are_put_in_as_plain_characters() {
        // Arrange（辞書の書き方・HTML に見える値も、そのまま出す。ADR-0027 §2）
        let message =
            Message::new("read-error.settings").arg("reason", "{ $x } <b>太字</b> {\"}\"} \\ 'a'");
        // Act
        let text = render(&message);
        // Assert
        assert_eq!(
            text,
            "設定を読み込めませんでした（{ $x } <b>太字</b> {\"}\"} \\ 'a'）"
        );
    }

    #[test]
    fn no_invisible_isolation_marks_are_added_around_values() {
        // Arrange
        let message = Message::new("read-error.format-at")
            .arg("format", "JSON")
            .arg("reason", "理由")
            .arg("place", "rules[0]");
        // Act
        let text = render(&message);
        // Assert（U+2068・U+2069 が入らない）
        assert!(!text.contains(['\u{2068}', '\u{2069}']), "{text:?}");
        assert_eq!(
            text,
            "書式にエラーがあるため読み込めません（JSON：理由）（場所：rules[0]）"
        );
    }

    #[test]
    fn a_missing_key_falls_back_to_the_code_and_values() {
        // Arrange（異常系：辞書に無いコード。中の文も決まった形になる）
        let message = Message::new("no.such")
            .arg("name", "X")
            .arg_message("why", Message::new("read-error.eof"));
        // Act
        let text = render(&message);
        // Assert
        assert_eq!(text, "no.such{name=X, why=read-error.eof{}}");
    }

    #[test]
    fn a_missing_value_falls_back_to_the_code_and_values() {
        // Arrange（異常系：文が使う値が足りない・名前が違う）
        let none = Message::new("read-error.settings");
        let other = Message::new("read-error.settings").arg("why", "x");
        // Act
        let got = [render(&none), render(&other)];
        // Assert
        assert_eq!(got, ["read-error.settings{}", "read-error.settings{why=x}"]);
    }

    // ---- 読めなかった理由の文（言い回しを変えたら、ここが変わる） ----

    #[test]
    fn read_error_reasons_are_the_japanese_sentences() {
        // Arrange（コードと、辞書に移す前にコアが作っていた文）
        let cases = [
            (
                "read-error.eof",
                "途中で終わっています。閉じる括弧や「\"」が足りません",
            ),
            (
                "read-error.end-of-stream",
                "途中で終わっています。閉じる括弧が足りません",
            ),
            (
                "read-error.trailing-comma",
                "最後の項目の後ろに、余計な「,」があります",
            ),
            (
                "read-error.trailing-characters",
                "終わりの後ろに、余計な文字があります",
            ),
            (
                "read-error.expected-comma-or-brace",
                "項目の間の「,」か、閉じる「}」が足りません",
            ),
            (
                "read-error.expected-comma-or-bracket",
                "項目の間の「,」か、閉じる「]」が足りません",
            ),
            (
                "read-error.expected-colon",
                "項目の名前の後ろに「:」が足りません",
            ),
            (
                "read-error.key-not-string",
                "項目の名前は「\"」で囲んでください",
            ),
            ("read-error.expected-value", "値がありません"),
            (
                "read-error.control-character",
                "文字列の中に、改行などの使えない文字があります",
            ),
            (
                "read-error.invalid-escape",
                "文字列の中の「\\」の使い方が違います",
            ),
            ("read-error.invalid-type", "値の種類が違います"),
            ("read-error.invalid-length", "値の数が違います"),
            (
                "read-error.duplicate-field",
                "同じ項目が 2 回書かれています",
            ),
            ("read-error.mapping-values", "「:」の位置が合っていません"),
            (
                "read-error.not-found-expected",
                "字下げか区切りの記号が合っていません",
            ),
            ("read-error.bad-token", "その位置には書けない文字があります"),
            ("read-error.unknown", "書き方に誤りがあります"),
            ("read-error.comment", "コメント（// や /* */）は書けません"),
        ];
        // Act
        let got: Vec<String> = cases
            .iter()
            .map(|(code, _)| render_code(code, &[]))
            .collect();
        // Assert
        let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
        assert_eq!(got, want);
    }

    #[test]
    fn read_error_wrappers_are_the_japanese_sentences() {
        // Arrange
        let reason = || Message::new("read-error.trailing-comma");
        let format = Message::new("read-error.format")
            .arg("format", "JSON")
            .arg_message("reason", reason());
        let format_at = Message::new("read-error.format-at")
            .arg("format", "YAML")
            .arg_message("reason", reason())
            .arg("place", "rules[0].require");
        let settings = Message::new("read-error.settings").arg_message("reason", reason());
        // Act
        let got = [render(&format), render(&format_at), render(&settings)];
        // Assert
        assert_eq!(
            got,
            [
                "書式にエラーがあるため読み込めません（JSON：最後の項目の後ろに、余計な「,」があります）",
                "書式にエラーがあるため読み込めません（YAML：最後の項目の後ろに、余計な「,」があります）（場所：rules[0].require）",
                "設定を読み込めませんでした（最後の項目の後ろに、余計な「,」があります）",
            ]
        );
    }

    #[test]
    fn every_read_error_key_is_checked_above() {
        // Arrange（辞書に足した文を、上の 2 つのテストに足し忘れない）
        let checked = 19 + 3;
        // Act
        let count = keys()
            .iter()
            .filter(|(area, _)| *area == "read-error")
            .count();
        // Assert
        assert_eq!(count, checked);
    }

    // ---- コードを実行時に受け取る口 ----

    #[test]
    fn render_code_matches_render() {
        // Arrange
        let args = [("reason".to_owned(), "理由".to_owned())];
        // Act
        let got = [
            render_code("read-error.settings", &args),
            render_code("read-error-settings", &args),
        ];
        // Assert（コードでも、辞書のキーでも同じ）
        let want = render(&Message::new("read-error.settings").arg("reason", "理由"));
        assert_eq!(got, [want.clone(), want]);
    }

    #[test]
    fn render_code_handles_verbatim_and_unknown_codes() {
        // Arrange（境界値：そのまま出す文・辞書に無いコード・値が無い）
        let text = [("text".to_owned(), "そのまま".to_owned())];
        let name = [("name".to_owned(), "X".to_owned())];
        // Act
        let got = [
            render_code("verbatim", &text),
            render_code("no.such", &name),
            render_code("no.such", &[]),
        ];
        // Assert
        assert_eq!(got, ["そのまま", "no.such{name=X}", "no.such{}"]);
    }
}
