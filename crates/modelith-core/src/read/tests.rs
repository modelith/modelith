//! `read` の単体テスト（F-AI-1）。プロジェクトの概要と、要素の詳細。

use modelith_plugin_protocol::{PortDirection, RelationDirection};

use super::*;

const SHOP: &str = "package Shop {\n    requirement def <'R1'> Fast { doc /* 速い */ }\n    part def Cart {\n        doc /* かご */\n        attribute n : Integer;\n        port pay : PayPort;\n    }\n    port def PayPort;\n    part cart : Cart;\n    satisfy Fast by Cart;\n    view overview : Views::GeneralView { expose Shop::Cart; }\n    view plain;\n}\n";

/// 1 つのファイルのプロジェクトを作る。
fn one(text: &str) -> [SourceFile<'_>; 1] {
    [SourceFile {
        path: "shop.sysml",
        text,
    }]
}

// --- outline：正常系 ---

#[test]
fn outline_lists_files_named_elements_and_diagrams() {
    // Arrange
    let files = one(SHOP);
    // Act
    let out = outline(&files);
    // Assert
    let names: Vec<&str> = out
        .elements
        .iter()
        .map(|e| e.qualified_name.as_str())
        .collect();
    assert_eq!(
        names,
        [
            "Shop",
            "Shop::Fast",
            "Shop::Cart",
            "Shop::Cart::n",
            "Shop::Cart::pay",
            "Shop::PayPort",
            "Shop::cart"
        ]
    );
    assert_eq!(out.files[0].path, "shop.sysml");
    let diagrams: Vec<(&str, &str)> = out
        .diagrams
        .iter()
        .map(|d| (d.qualified_name.as_str(), d.kind.as_str()))
        .collect();
    assert_eq!(
        diagrams,
        [("Shop::overview", "GeneralView"), ("Shop::plain", "view")]
    );
}

#[test]
fn outline_gives_kind_short_name_file_and_range() {
    // Arrange
    let files = one(SHOP);
    // Act
    let out = outline(&files);
    // Assert
    let fast = &out.elements[1];
    assert_eq!(
        (
            fast.name.as_str(),
            fast.short_name.as_deref(),
            fast.kind.as_str(),
            fast.file.as_str()
        ),
        ("Fast", Some("R1"), "requirement def", "shop.sysml")
    );
    assert_eq!(
        (
            fast.range.start.line,
            fast.range.start.character,
            fast.range.end.line
        ),
        (1, 4, 1)
    );
    assert_eq!(out.elements[0].short_name, None);
}

#[test]
fn outline_keeps_the_order_of_files_and_names_each_file() {
    // Arrange
    let files = [
        SourceFile {
            path: "b/parts.sysml",
            text: "package Parts { part def Wheel; }",
        },
        SourceFile {
            path: "a.sysml",
            text: "package App { part w : Parts::Wheel; }",
        },
    ];
    // Act
    let out = outline(&files);
    // Assert
    let got: Vec<(&str, &str)> = out
        .elements
        .iter()
        .map(|e| (e.qualified_name.as_str(), e.file.as_str()))
        .collect();
    assert_eq!(
        got,
        [
            ("Parts", "b/parts.sysml"),
            ("Parts::Wheel", "b/parts.sysml"),
            ("App", "a.sysml"),
            ("App::w", "a.sysml")
        ]
    );
}

// --- outline：境界値・異常系 ---

#[test]
fn outline_of_no_files_and_of_an_empty_file_is_empty() {
    // Arrange
    let none: [SourceFile<'_>; 0] = [];
    let empty = one("");
    // Act
    let a = outline(&none);
    let b = outline(&empty);
    // Assert
    assert_eq!(a, ProjectOutline::default());
    assert_eq!(
        (b.files.len(), b.elements.len(), b.diagrams.len()),
        (1, 0, 0)
    );
}

#[test]
fn outline_quotes_names_that_need_it_and_counts_utf16_columns() {
    // Arrange（引用名と、UTF-16 で 2 つに数える文字の後ろの要素）
    let files = one("package P { part def '電気 ケトル' { attribute n; } /* 😀 */ part def B; }");
    // Act
    let out = outline(&files);
    // Assert
    assert_eq!(out.elements[1].qualified_name, "P::'電気 ケトル'");
    assert_eq!(out.elements[1].name, "電気 ケトル");
    assert_eq!(out.elements[2].qualified_name, "P::'電気 ケトル'::n");
    // 「😀」は UTF-16 で 2 つ。B の前までは、文字数より 1 多い
    let b = &out.elements[3];
    let chars_before = files[0].text.chars().take_while(|&c| c != 'B').count() - "part def ".len();
    assert_eq!(b.range.start.character as usize, chars_before + 1);
}

#[test]
fn outline_still_lists_what_it_can_read_from_a_broken_file() {
    // Arrange（閉じていない括弧）
    let files = one("package P { part def A; part def B {");
    // Act
    let out = outline(&files);
    // Assert
    let names: Vec<&str> = out.elements.iter().map(|e| e.name.as_str()).collect();
    assert!(names.contains(&"A"), "{names:?}");
}

// --- element：正常系 ---

#[test]
fn element_gives_doc_members_ports_and_relations() {
    // Arrange
    let files = one(SHOP);
    // Act
    let cart = element(&files, "Shop::Cart").unwrap();
    // Assert
    assert_eq!(cart.doc.as_deref(), Some("かご"));
    assert_eq!(cart.element_type, None);
    let members: Vec<(&str, &str)> = cart
        .members
        .iter()
        .map(|m| (m.qualified_name.as_str(), m.kind.as_str()))
        .collect();
    assert_eq!(
        members,
        [("Shop::Cart::n", "attribute"), ("Shop::Cart::pay", "port")]
    );
    assert_eq!(cart.ports.len(), 1);
    assert_eq!(
        (
            cart.ports[0].name.as_str(),
            cart.ports[0].port_type.as_deref(),
            cart.ports[0].direction
        ),
        ("pay", Some("PayPort"), Some(PortDirection::Inout))
    );
    assert!(
        cart.relations.iter().any(|r| r.kind == "satisfy"
            && r.direction == RelationDirection::Outgoing
            && r.other == "Shop::Fast"),
        "{:?}",
        cart.relations
    );
}

#[test]
fn element_gives_the_incoming_side_of_a_relation_and_the_type_of_a_usage() {
    // Arrange
    let files = one(SHOP);
    // Act
    let fast = element(&files, "Shop::Fast").unwrap();
    let cart = element(&files, "Shop::cart").unwrap();
    // Assert
    assert!(
        fast.relations.iter().any(|r| r.kind == "satisfy"
            && r.direction == RelationDirection::Incoming
            && r.other == "Shop::Cart"),
        "{:?}",
        fast.relations
    );
    assert_eq!(cart.element_type.as_deref(), Some("Cart"));
    assert!(
        cart.relations.iter().any(|r| r.kind == "definedBy"
            && r.direction == RelationDirection::Outgoing
            && r.other == "Shop::Cart"),
        "{:?}",
        cart.relations
    );
}

#[test]
fn element_finds_relations_to_elements_of_other_files() {
    // Arrange
    let files = [
        SourceFile {
            path: "req.sysml",
            text: "package Req { requirement def Safe; }",
        },
        SourceFile {
            path: "app.sysml",
            text: "package App { part def Brake; satisfy Req::Safe by Brake; }",
        },
    ];
    // Act
    let brake = element(&files, "App::Brake").unwrap();
    let safe = element(&files, "Req::Safe").unwrap();
    // Assert
    assert_eq!(brake.summary.file, "app.sysml");
    assert_eq!(
        brake
            .relations
            .iter()
            .map(|r| (r.kind.as_str(), r.direction, r.other.as_str()))
            .collect::<Vec<_>>(),
        [("satisfy", RelationDirection::Outgoing, "Req::Safe")]
    );
    assert_eq!(
        safe.relations
            .iter()
            .map(|r| (r.kind.as_str(), r.direction, r.other.as_str()))
            .collect::<Vec<_>>(),
        [("satisfy", RelationDirection::Incoming, "App::Brake")]
    );
}

#[test]
fn element_reads_a_nested_member_without_ports_or_relations() {
    // Arrange（図に描かない入れ子の要素）
    let files = one(SHOP);
    // Act
    let n = element(&files, "Shop::Cart::n").unwrap();
    // Assert
    assert_eq!(
        (n.summary.kind.as_str(), n.element_type.as_deref()),
        ("attribute", Some("Integer"))
    );
    assert!(n.members.is_empty() && n.ports.is_empty() && n.relations.is_empty());
}

// --- element：異常系・境界値 ---

#[test]
fn element_is_none_for_an_unknown_name_an_empty_name_and_no_files() {
    // Arrange
    let files = one(SHOP);
    let none: [SourceFile<'_>; 0] = [];
    // Act
    let unknown = element(&files, "Shop::Nope");
    let partial = element(&files, "Cart");
    let empty = element(&files, "");
    let no_files = element(&none, "Shop");
    // Assert
    assert_eq!(
        (unknown, partial, empty, no_files),
        (None, None, None, None)
    );
}

#[test]
fn element_takes_the_first_of_two_elements_with_the_same_name() {
    // Arrange（同じ修飾名が 2 つのファイルにある）
    let files = [
        SourceFile {
            path: "a.sysml",
            text: "package P { part def A; }",
        },
        SourceFile {
            path: "b.sysml",
            text: "package P { part def A { doc /* 2 つめ */ } }",
        },
    ];
    // Act
    let a = element(&files, "P::A").unwrap();
    // Assert
    assert_eq!((a.summary.file.as_str(), a.doc), ("a.sysml", None));
}

#[test]
fn element_finds_a_quoted_name() {
    // Arrange
    let files = one("package P { part def '電気 ケトル' { doc /* 湯を沸かす */ } }");
    // Act
    let kettle = element(&files, "P::'電気 ケトル'").unwrap();
    // Assert
    assert_eq!(kettle.summary.name, "電気 ケトル");
    assert_eq!(kettle.doc.as_deref(), Some("湯を沸かす"));
}
