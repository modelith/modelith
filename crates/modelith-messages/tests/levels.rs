//! 知らせの種類の名前（levels.ftl）が、これまでどおりの文になることを確かめる（ADR-0027 §3）。

use modelith_core::levels::KINDS;
use modelith_messages::render;

/// 種類のコードと、画面に出す名前。
const CASES: &[(&str, &str)] = &[
    (
        "trace.derive",
        "トレースの抜け：上位・下位の要求とのつながり（derivation）",
    ),
    (
        "trace.satisfy",
        "トレースの抜け：要求を満たす要素（satisfy）",
    ),
    (
        "trace.verify",
        "トレースの抜け：要求を確かめる検証（verify）",
    ),
    ("unsupported", "まだ扱えない書き方"),
];

#[test]
fn every_kind_label_is_the_japanese_name() {
    for (code, expected) in CASES {
        // Arrange
        let kind = KINDS.iter().find(|k| k.code == *code).expect("kind");
        // Act
        let text = render(&kind.label.message());
        // Assert
        assert_eq!(&text, expected, "{code}");
    }
}

#[test]
fn every_key_in_the_file_is_a_kind_label() {
    // Arrange
    let keys: Vec<&str> = include_str!("../locales/ja/levels.ftl")
        .lines()
        .filter(|l| !l.starts_with("#") && !l.trim().is_empty())
        .filter_map(|l| l.split(" = ").next())
        .collect();
    // Act
    let labels: Vec<String> = KINDS.iter().map(|k| k.label.0.replace(".", "-")).collect();
    // Assert
    assert_eq!(keys, labels);
    assert_eq!(KINDS.len(), CASES.len());
}
