//! モデルの問題の文（`locales/ja/model.ftl`）が、辞書に移す前にコアが作っていた日本語の文と同じであることを確かめる（ADR-0027 §3）。
//!
//! 画面はトレースの抜けを文の終わりの形（`（verify）` など）で見分けているので、言い回しを変えたら、ここが変わる。

use std::collections::BTreeSet;

use modelith_core::message::Message;
use modelith_messages::render;

/// 辞書のテキスト（キーの足し忘れを見つけるために読む）。
const DICTIONARY: &str = include_str!("../locales/ja/model.ftl");

/// 値が `name` 1 つの文を作る。
fn named(code: &'static str, name: &str) -> Message {
    Message::new(code).arg("name", name)
}

/// 値が連鎖（`chain`）と段（`step`）の文を作る。
fn step(code: &'static str, chain: &str, step: &str) -> Message {
    Message::new(code).arg("chain", chain).arg("step", step)
}

/// 値が図（`view`）と絞り込みの式（`filter`）の文を作る。
fn view_filter(code: &'static str, view: &str, filter: &str) -> Message {
    Message::new(code).arg("view", view).arg("filter", filter)
}

/// 見つからない相手の文（コアが返す形と、辞書に移す前の文）。
fn missing_cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            named("model.type-missing", "Shop::Nope").arg("who", "x"),
            "型「Shop::Nope」が見つかりません（x）",
        ),
        (
            named("model.general-missing", "Nope").arg("who", "A"),
            "引き継ぐ定義「Nope」が見つかりません（A）",
        ),
        (
            Message::new("model.alias-target-missing")
                .arg("alias", "T")
                .arg("name", "Nope"),
            "別名「T」の指す先「Nope」が見つかりません（alias）",
        ),
        (
            named("model.import-missing", "Nowhere"),
            "インポートする相手「Nowhere」が見つかりません（import）",
        ),
        (
            named("model.metadata-about-missing", "Nope"),
            "メタデータを付ける相手「Nope」が見つかりません（metadata about）",
        ),
        (
            named("model.comment-about-missing", "Nope"),
            "メモを付ける相手「Nope」が見つかりません（comment about）",
        ),
        (
            named("model.satisfy-end-missing", "Nope"),
            "「満たす」関係の相手「Nope」が見つかりません（satisfy）",
        ),
        (
            named("model.verify-end-missing", "Nope"),
            "「検証する」関係の相手「Nope」が見つかりません（verify）",
        ),
        (
            named("model.frame-concern-missing", "Nope::C"),
            "扱う関心事「Nope::C」が見つかりません（frame）",
        ),
        (
            named("model.derive-end-missing", "Nope"),
            "「導出」関係の相手「Nope」が見つかりません（derivation）",
        ),
        (
            named("model.allocate-end-missing", "Nope"),
            "「割り当て」関係の相手「Nope」が見つかりません（allocate）",
        ),
        (
            named("model.dependency-end-missing", "Nope"),
            "「依存」関係の相手「Nope」が見つかりません（dependency）",
        ),
        (
            named("model.bind-end-missing", "gone"),
            "「結び付け」の相手「gone」が見つかりません（bind）",
        ),
        (
            named("model.transition-end-missing", "nope"),
            "「遷移」の相手「nope」が見つかりません（transition）",
        ),
        (
            named("model.succession-end-missing", "a.gone"),
            "「順序」の相手「a.gone」が見つかりません（succession）",
        ),
        (
            named("model.succession-flow-end-missing", "nope"),
            "「順序付きの流れ」の相手「nope」が見つかりません（succession flow）",
        ),
        (
            named("model.line-end-missing", "nope.p").arg("rel", "connect"),
            "線の接続先「nope.p」が見つかりません（connect）",
        ),
        (
            named("model.message-end-not-inside", "z").arg("owner", "S"),
            "メッセージの相手「z」が「S」の中にありません（message）",
        ),
        (
            Message::new("model.port-missing")
                .arg("port", "nope")
                .arg("owner", "Eng"),
            "ポート「nope」が Eng にありません",
        ),
        (
            step("model.line-end-step-missing", "e.cyl.p.zz", "zz").arg("rel", "flow"),
            "線の接続先「e.cyl.p.zz」の「zz」が見つかりません（flow）",
        ),
        (
            step("model.message-end-step-missing", "a.sub.x", "x"),
            "メッセージの相手「a.sub.x」の「x」が見つかりません（message）",
        ),
        (
            step("model.bind-end-step-missing", "w.nope", "nope"),
            "「結び付け」の相手「w.nope」の「nope」が見つかりません（bind）",
        ),
    ]
}

/// 同じ名前・シナリオ・まだ扱えない書き方・図・トレースの抜けの文（コアが返す形と、辞書に移す前の文）。
fn other_cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            named("model.name-duplicate", "P"),
            "「P」という名前は、同じ場所で既に使われています。どちらかの名前を変えてください",
        ),
        (
            named("model.name-duplicate-in", "A").arg("place", "P"),
            "「A」という名前は、「P」の中で既に使われています。どちらかの名前を変えてください",
        ),
        (
            named("model.scenario-order-cyclic", "S"),
            "シナリオ「S」の順序が循環しています（succession）",
        ),
        (
            Message::new("model.unsupported-syntax").arg("head", "part def ''"),
            "「part def ''」は Modelith ではまだ扱えないため、図とツリーに出ません",
        ),
        (
            Message::new("model.import-filter-unsupported")
                .arg("path", "Lib")
                .arg("filter", "level > 1"),
            "インポート「Lib」の絞り込み「level > 1」はまだ扱えないため、絞り込まずに取り込みます（import の [ ]・filter）",
        ),
        (
            Message::new("model.view-kind-undrawable")
                .arg("view", "v")
                .arg_message("label", Message::new("model.view-label-grid"))
                .arg("std", "GridView"),
            "図「v」の種類（グリッドビュー）の描き方はまだ無いため、一般ビューとして描きます（GridView）",
        ),
        (
            Message::new("model.view-render-unsupported")
                .arg("view", "a")
                .arg("render", "r"),
            "図「a」の表し方（r）はまだ扱えないため、図として描きます（render）",
        ),
        (
            view_filter(
                "model.view-filter-unsupported",
                "v",
                "@Safety and level > 1",
            ),
            "図「v」の絞り込み「@Safety and level > 1」はまだ扱えないため、絞り込まずに描きます（filter）",
        ),
        (
            view_filter("model.view-expose-filter-unsupported", "v", "level > 1"),
            "図「v」の絞り込み「level > 1」はまだ扱えないため、絞り込まずに描きます（expose の [ ]）",
        ),
        (
            Message::new("model.view-expose-missing")
                .arg("view", "v")
                .arg("name", "Q::Z"),
            "図「v」に出す要素「Q::Z」が見つかりません（expose）",
        ),
        (
            Message::new("model.trace-not-expanded").arg("requirement", "Need"),
            "Need：どの下位の要求にも展開されていません（derivation）",
        ),
        (
            Message::new("model.trace-no-source").arg("requirement", "FlowReq"),
            "FlowReq：導出元の上位の要求がありません（derivation）",
        ),
        (
            Message::new("model.trace-not-satisfied").arg("requirement", "<'K3'> FlowReq"),
            "<'K3'> FlowReq：この要求を満たす要素がありません（satisfy）",
        ),
        (
            Message::new("model.trace-not-verified").arg("requirement", "<'K3'> FlowReq"),
            "<'K3'> FlowReq：この要求を確かめる検証がありません（verify）",
        ),
    ]
}

/// 図の種類の、画面での名前（コアが返す形と、辞書に移す前の名前）。
fn label_cases() -> Vec<(Message, &'static str)> {
    vec![
        (Message::new("model.view-label-general"), "一般ビュー"),
        (
            Message::new("model.view-label-interconnection"),
            "内部ブロック図",
        ),
        (
            Message::new("model.view-label-action-flow"),
            "アクティビティ図",
        ),
        (
            Message::new("model.view-label-state-transition"),
            "状態遷移図",
        ),
        (Message::new("model.view-label-sequence"), "シーケンス図"),
        (
            Message::new("model.view-label-geometry"),
            "ジオメトリビュー",
        ),
        (Message::new("model.view-label-grid"), "グリッドビュー"),
        (Message::new("model.view-label-browser"), "ブラウザビュー"),
        (named("model.view-label-other", "MyView"), "MyView"),
    ]
}

/// 文にしたものと、辞書に移す前の文を、並べて返す。
fn rendered(cases: &[(Message, &'static str)]) -> (Vec<String>, Vec<&'static str>) {
    (
        cases.iter().map(|(message, _)| render(message)).collect(),
        cases.iter().map(|(_, text)| *text).collect(),
    )
}

#[test]
fn missing_reference_problems_are_the_japanese_sentences() {
    // Arrange
    let cases = missing_cases();
    // Act
    let (got, want) = rendered(&cases);
    // Assert
    assert_eq!(got, want);
}

#[test]
fn other_model_problems_are_the_japanese_sentences() {
    // Arrange
    let cases = other_cases();
    // Act
    let (got, want) = rendered(&cases);
    // Assert
    assert_eq!(got, want);
}

#[test]
fn view_labels_are_the_japanese_names() {
    // Arrange
    let cases = label_cases();
    // Act
    let (got, want) = rendered(&cases);
    // Assert
    assert_eq!(got, want);
}

#[test]
fn every_view_label_fits_into_the_sentence_about_a_view_kind_without_a_drawing() {
    // Arrange（中の文を先に文にしてから差し込む。専用の描き方が無い 3 つ）
    let kinds = [
        ("model.view-label-geometry", "GeometryView"),
        ("model.view-label-grid", "GridView"),
        ("model.view-label-browser", "BrowserView"),
    ];
    // Act
    let got = kinds.map(|(label, std)| {
        render(
            &Message::new("model.view-kind-undrawable")
                .arg("view", "図 1")
                .arg_message("label", Message::new(label))
                .arg("std", std),
        )
    });
    // Assert
    assert_eq!(
        got,
        [
            "図「図 1」の種類（ジオメトリビュー）の描き方はまだ無いため、一般ビューとして描きます（GeometryView）",
            "図「図 1」の種類（グリッドビュー）の描き方はまだ無いため、一般ビューとして描きます（GridView）",
            "図「図 1」の種類（ブラウザビュー）の描き方はまだ無いため、一般ビューとして描きます（BrowserView）",
        ]
    );
}

#[test]
fn values_with_dictionary_syntax_are_put_in_as_plain_characters() {
    // Arrange（境界値：名前に辞書の書き方・引用符・空の文字。モデルのテキストから来る値は何でもありうる）
    let braces = named("model.type-missing", "{ $who }").arg("who", "'a b'");
    let empty = named("model.message-end-not-inside", "").arg("owner", "");
    // Act
    let got = [render(&braces), render(&empty)];
    // Assert
    assert_eq!(
        got,
        [
            "型「{ $who }」が見つかりません（'a b'）",
            "メッセージの相手「」が「」の中にありません（message）",
        ]
    );
}

#[test]
fn a_model_problem_without_its_values_falls_back_to_the_code() {
    // Arrange（異常系：値が足りない・値の名前が違う）
    let none = Message::new("model.type-missing");
    let other = Message::new("model.type-missing").arg("type", "A");
    // Act
    let got = [render(&none), render(&other)];
    // Assert
    assert_eq!(got, ["model.type-missing{}", "model.type-missing{type=A}"]);
}

/// 辞書のキー（行の頭から「 =」の前まで）を並べる。
fn keys() -> BTreeSet<String> {
    DICTIONARY
        .lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key.to_owned()))
        .collect()
}

#[test]
fn only_the_view_labels_render_without_values() {
    // Arrange（値を取らない文は、図の種類の名前の 8 つだけ。ほかは、値なしでは決まった形に戻る）
    let without_values: BTreeSet<String> = label_cases()
        .iter()
        .filter(|(message, _)| message.args.is_empty())
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    // Act（決まった形は `キー{}`）
    let rendered: BTreeSet<String> = keys()
        .into_iter()
        .filter(|key| modelith_messages::render_code(key, &[]) != format!("{key}{{}}"))
        .collect();
    // Assert
    assert_eq!(rendered, without_values);
    assert_eq!(rendered.len(), 8);
}

#[test]
fn every_model_key_is_checked_above() {
    // Arrange（辞書に足した文を、上の表に足し忘れない。辞書から消した文が表に残らない）
    let in_dictionary = keys();
    // Act
    let checked: BTreeSet<String> = [missing_cases(), other_cases(), label_cases()]
        .concat()
        .iter()
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    // Assert
    assert_eq!(checked, in_dictionary);
    assert_eq!(in_dictionary.len(), 45);
}
