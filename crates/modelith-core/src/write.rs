//! モデルを書く操作のうち、提案を作る部分（ADR-0024 の 1「意図を渡す」・4。要求 F-AI-2）。
//!
//! 契約の [`EditRequest`]（要素を修飾名で指す）を、画面と同じ編集の意図にして当て、何も書かずに差分（[`EditProposal`]）を返す。
//! 書き込みは呼ぶ側が行う。ここではファイルを読み書きしない（ファイルのテキストと版は、呼ぶ側が渡す）。
//! 版（`baseVersion`）は中身を決めない文字列で、呼ぶ側が書き込むときに今の版と比べる。

use std::collections::BTreeMap;

use modelith_plugin_protocol::{FileChange, Range, TextEdit};
// 契約の型（呼ぶ側が plugin-sdk に直接頼らなくても使えるように、ここからも出す）
pub use modelith_plugin_protocol::{EditProposal, EditRequest};

use crate::edit::text::Utf16;
use crate::edit::{self, Intent, qualified_name};
use crate::plugin_host::Positions;
use crate::project::ParseResult;
use crate::project::merge::parse_file;
use crate::read::{self, Project, SourceFile};

/// 版つきのファイル 1 つ。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VersionedFile<'a> {
    /// プロジェクトのフォルダからのパス（`/` 区切り）。
    pub path: &'a str,
    /// ファイルのテキスト全体。
    pub text: &'a str,
    /// このテキストの版（呼ぶ側が決める文字列。提案の `baseVersion` にそのまま入れる）。
    pub version: &'a str,
}

/// 提案を作る対象のプロジェクト（呼ぶ側が読んで渡す）。
#[derive(Debug, Clone, Copy)]
pub struct Workspace<'a> {
    /// モデルのファイル。
    pub files: &'a [VersionedFile<'a>],
    /// プロジェクトの設定ファイル（`modelith.json`）のテキスト。無ければ `None`。
    pub project_file: Option<&'a str>,
    /// プラグインのファイル（プラグインの ID → プラグインのフォルダからの相対パス → テキスト）。
    pub plugin_files: &'a BTreeMap<String, BTreeMap<String, String>>,
}

/// 編集の意図を当てた提案を作る（何も書かない）。
///
/// # 引数
///
/// - `ws`：プロジェクト（ファイルのテキストと版、設定ファイル、プラグインのファイル）
/// - `request`：編集の意図（要素は修飾名で指す）
///
/// # 戻り値
///
/// 差分（変わるファイルごとに、前提の版と編集）と、当てたあとのプロジェクトの問題一覧。何も変わらなければ、差分は空。
/// 当てられないとき（指す要素やファイルが無い、名前が使えない、括弧が閉じていないなど）は、理由の文（`Err`）。
///
/// # 例
///
/// ```text
/// // a.sysml（版 "v1"）「package P {\n    part def A;\n}\n」
/// propose(ws, Rename { element: "P::A", name: "B" })
///   → Ok({ changes: [{ file: "a.sysml", baseVersion: "v1", edits: [1:13–1:14 を "B" に] }], problems: [] })
/// propose(ws, Rename { element: "P::Nope", name: "B" })
///   → Err("操作する要素「P::Nope」が見つかりません。テキストが先に変わった可能性があります")
/// ```
pub fn propose(ws: &Workspace<'_>, request: &EditRequest) -> Result<EditProposal, String> {
    let (at, new_text) = match request {
        EditRequest::ReplaceText { file, text } => {
            let at = ws
                .files
                .iter()
                .position(|f| f.path == file)
                .ok_or_else(|| format!("ファイル「{file}」が見つかりません"))?;
            (at, text.clone())
        }
        _ => {
            let parsed = parse_all(ws.files);
            // ReplaceText は上で扱ったので、ここでは必ず意図になる
            let Some((anchor, intent)) = intent_of(request) else {
                return Ok(EditProposal::default());
            };
            let at = file_of(&parsed, anchor).ok_or_else(|| edit::missing(anchor))?;
            let others = parsed
                .into_iter()
                .enumerate()
                .filter_map(|(i, p)| (i != at).then_some(p).flatten())
                .collect();
            let old = ws.files[at].text;
            let outcome = edit::edit_in(old, others, &intent).map_err(|r| r.reason)?;
            (at, apply(old, &outcome.edits))
        }
    };
    let file = ws.files[at];
    let edits = text_edits(file.text, &new_text);
    let changes = if edits.is_empty() {
        Vec::new()
    } else {
        vec![FileChange {
            file: file.path.to_owned(),
            base_version: file.version.to_owned(),
            edits,
        }]
    };
    let after: Vec<SourceFile<'_>> = ws
        .files
        .iter()
        .enumerate()
        .map(|(i, f)| SourceFile {
            path: f.path,
            text: if i == at { &new_text } else { f.text },
        })
        .collect();
    let problems = read::check(&Project {
        files: &after,
        project_file: ws.project_file,
        plugin_files: ws.plugin_files,
    });
    Ok(EditProposal { changes, problems })
}

/// 契約の編集の意図を、コアの編集の意図にする。あわせて、どのファイルに書くかを決める要素（その要素のあるファイルに書く）の修飾名を返す。
///
/// # 引数
///
/// - `request`：契約の編集の意図（`ReplaceText` 以外）
///
/// # 戻り値
///
/// （書くファイルを決める要素の修飾名、コアの編集の意図）。要素は修飾名のキー（`q:`）で指す。
/// 関係は「出る側」の要素のあるファイルに書く。`ReplaceText` は意図にならないので `None`。
///
/// # 例
///
/// ```text
/// intent_of(Rename { element: "P::A", name: "B" })                       → Some(("P::A", Rename { key: "q:P::A", name: "B" }))
/// intent_of(AddRelation { kind: "derivation", from: "P::R2", to: "P::R1" }) → Some(("P::R2", Connect { rel: "derive", from: "q:P::R2", to: "q:P::R1" }))
/// intent_of(AddElement { kind: "part def", name: "B", parent: "P" })      → Some(("P", AddElement { kind: "part def", name: "B", parent: "q:P" }))
/// intent_of(ReplaceText { file: "a.sysml", text: "" })                    → None
/// ```
fn intent_of(request: &EditRequest) -> Option<(&str, Intent)> {
    let q = |name: &str| format!("q:{name}");
    Some(match request {
        EditRequest::AddElement { kind, name, parent } => (
            parent,
            Intent::AddElement {
                kind: kind.clone(),
                name: name.clone(),
                parent: q(parent),
            },
        ),
        EditRequest::AddRelation { kind, from, to } => (
            from,
            Intent::Connect {
                rel: relation_word(kind).to_owned(),
                from: q(from),
                to: q(to),
                from_port: None,
                to_port: None,
                ctx: None,
            },
        ),
        EditRequest::Rename { element, name } => (
            element,
            Intent::Rename {
                key: q(element),
                name: name.clone(),
                ctx: None,
            },
        ),
        EditRequest::Delete { element } => (
            element,
            Intent::Delete {
                keys: vec![q(element)],
                ctx: None,
            },
        ),
        EditRequest::SetDoc { element, doc } => (
            element,
            Intent::SetDoc {
                key: q(element),
                text: doc.clone(),
                ctx: None,
            },
        ),
        EditRequest::ReplaceText { .. } => return None,
    })
}

/// 契約の関係の種類の言葉を、コアの編集の言葉にする（`read` が返す言葉の逆）。
///
/// # 引数
///
/// - `kind`：契約の関係の種類
///
/// # 戻り値
///
/// コアの言葉。言い換えの無い種類はそのまま（扱えない種類は、編集が理由をつけて断る）。
///
/// # 例
///
/// ```text
/// relation_word("derivation")  → "derive"
/// relation_word("composition") → "comp"
/// relation_word("satisfy")     → "satisfy"
/// ```
fn relation_word(kind: &str) -> &str {
    match kind {
        "derivation" => "derive",
        "composition" => "comp",
        other => other,
    }
}

/// ファイルをすべて解析する（大きすぎて解析しないファイルは `None`）。
///
/// # 引数
///
/// - `files`：プロジェクトのファイル
///
/// # 戻り値
///
/// ファイルごとの解析結果（渡した順）。
///
/// # 例
///
/// ```text
/// parse_all([a.sysml「part def A;」]) → [Some(entries は [A])]
/// ```
fn parse_all(files: &[VersionedFile<'_>]) -> Vec<Option<ParseResult>> {
    files.iter().map(|f| parse_file(f.text)).collect()
}

/// 修飾名の要素のあるファイルを探す（同じ修飾名が 2 つ以上あれば、最初のファイル。`read::element` と同じ）。
///
/// # 引数
///
/// - `parsed`：ファイルごとの解析結果
/// - `name`：要素の修飾名
///
/// # 戻り値
///
/// ファイルの番号。どのファイルにも無ければ `None`。
///
/// # 例
///
/// ```text
/// file_of([a.sysml（P::A）, b.sysml（Q::B）], "Q::B") → Some(1)
/// file_of([a.sysml（P::A）], "P::Nope")              → None
/// ```
fn file_of(parsed: &[Option<ParseResult>], name: &str) -> Option<usize> {
    parsed.iter().position(|p| {
        p.as_ref().is_some_and(|p| {
            (0..p.entries.len())
                .any(|i| !p.entries[i].name.is_empty() && qualified_name(&p.entries, i) == name)
        })
    })
}

/// 編集（UTF-16 の位置）をテキストに当てる。
///
/// # 引数
///
/// - `text`：元のテキスト
/// - `edits`：当てる編集（位置は元のテキストのもの。重ならないこと）
///
/// # 戻り値
///
/// 当てたあとのテキスト。
///
/// # 例
///
/// ```text
/// apply("part def A;", [{ start: 9, end: 10, text: "B" }]) → "part def B;"
/// apply("abc", [])                                          → "abc"
/// ```
fn apply(text: &str, edits: &[edit::TextEdit]) -> String {
    let utf16 = Utf16::new(text);
    let mut sorted: Vec<&edit::TextEdit> = edits.iter().collect();
    sorted.sort_by_key(|e| std::cmp::Reverse(e.start));
    let mut out = text.to_owned();
    for e in sorted {
        out.replace_range(utf16.byte(e.start)..utf16.byte(e.end), &e.text);
    }
    out
}

/// 元のテキストと新しいテキストの違いを、契約の編集（行・列の範囲）にする。
///
/// # 引数
///
/// - `old`：元のテキスト
/// - `new`：新しいテキスト
///
/// # 戻り値
///
/// 違う所を 1 つにまとめた編集（前後の同じ部分を除いた範囲）。同じなら空。
///
/// # 例
///
/// ```text
/// text_edits("part def A;", "part def B;") → [{ range: 0:9–0:10, newText: "B" }]
/// text_edits("abc", "abc")                 → []
/// ```
fn text_edits(old: &str, new: &str) -> Vec<TextEdit> {
    let positions = Positions::new(old);
    edit::text::diff(old, new)
        .into_iter()
        .map(|(start, end, new_text)| TextEdit {
            range: Range {
                start: positions.position(start),
                end: positions.position(end),
            },
            new_text,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use modelith_plugin_protocol::Position;

    use super::*;

    const SHOP: &str = "package Shop {\n    requirement def Fast;\n    part def Cart;\n}\n";
    const APP: &str = "package App {\n    part c : Shop::Cart;\n    part x : Shop::Nope;\n}\n";

    /// shop.sysml（版 s1）と app.sysml（版 a1）のプロジェクトに、意図を当てる。
    fn run(request: EditRequest) -> Result<EditProposal, String> {
        let files = [
            VersionedFile {
                path: "shop.sysml",
                text: SHOP,
                version: "s1",
            },
            VersionedFile {
                path: "app.sysml",
                text: APP,
                version: "a1",
            },
        ];
        propose(
            &Workspace {
                files: &files,
                project_file: None,
                plugin_files: &BTreeMap::new(),
            },
            &request,
        )
    }

    /// 提案の差分を当てたあとのテキスト（差分は 1 つのファイルに 1 つ、という前提で確かめる）。
    fn applied(proposal: &EditProposal, old: &str) -> String {
        let change = &proposal.changes[0];
        let positions = Positions::new(old);
        let offset = |p: Position| positions.offset(p).expect("範囲の中の位置");
        let edits: Vec<edit::TextEdit> = change
            .edits
            .iter()
            .map(|e| edit::TextEdit {
                start: offset(e.range.start),
                end: offset(e.range.end),
                text: e.new_text.clone(),
            })
            .collect();
        apply(old, &edits)
    }

    /// 問題の文だけを取り出す。
    fn messages(proposal: &EditProposal) -> Vec<&str> {
        proposal
            .problems
            .iter()
            .map(|p| p.diagnostic.message.as_str())
            .collect()
    }

    // --- 正常系 ---

    #[test]
    fn rename_returns_the_diff_with_the_base_version_and_the_problems_after() {
        // Act
        let got = run(EditRequest::Rename {
            element: "Shop::Fast".into(),
            name: "Quick".into(),
        })
        .unwrap();
        // Assert（書くのは要素のあるファイル。ほかのファイルの参照切れは、当てたあとも残る）
        assert_eq!(got.changes.len(), 1);
        assert_eq!(
            (
                got.changes[0].file.as_str(),
                got.changes[0].base_version.as_str()
            ),
            ("shop.sysml", "s1")
        );
        assert_eq!(
            applied(&got, SHOP),
            "package Shop {\n    requirement def Quick;\n    part def Cart;\n}\n"
        );
        assert_eq!(messages(&got), ["型「Shop::Nope」が見つかりません（x）"]);
    }

    #[test]
    fn the_problems_are_those_after_the_change() {
        // Arrange（見つからなかった型を足すと、問題が消える）
        let request = EditRequest::AddElement {
            kind: "part def".into(),
            name: "Nope".into(),
            parent: "Shop".into(),
        };
        // Act
        let got = run(request).unwrap();
        // Assert
        assert_eq!(
            applied(&got, SHOP),
            "package Shop {\n    requirement def Fast;\n    part def Cart;\n    part def Nope;\n}\n"
        );
        assert!(got.problems.is_empty(), "{:?}", got.problems);
    }

    #[test]
    fn add_relation_writes_in_the_file_of_the_from_element_with_the_contract_words() {
        // Act
        let satisfy = run(EditRequest::AddRelation {
            kind: "satisfy".into(),
            from: "Shop::Cart".into(),
            to: "Shop::Fast".into(),
        })
        .unwrap();
        // Assert
        assert_eq!(satisfy.changes[0].file, "shop.sysml");
        assert!(applied(&satisfy, SHOP).contains("satisfy Fast by Cart;"));
    }

    #[test]
    fn delete_and_set_doc_change_the_named_element() {
        // Act
        let deleted = run(EditRequest::Delete {
            element: "Shop::Fast".into(),
        })
        .unwrap();
        let documented = run(EditRequest::SetDoc {
            element: "Shop::Cart".into(),
            doc: "かご".into(),
        })
        .unwrap();
        // Assert
        assert_eq!(
            applied(&deleted, SHOP),
            "package Shop {\n    part def Cart;\n}\n"
        );
        assert!(applied(&documented, SHOP).contains("doc /* かご */"));
    }

    #[test]
    fn replace_text_replaces_the_file_and_reports_the_new_problems() {
        // Arrange（参照切れを直した中身に書き換える）
        let text = "package App {\n    part c : Shop::Cart;\n}\n";
        // Act
        let got = run(EditRequest::ReplaceText {
            file: "app.sysml".into(),
            text: text.into(),
        })
        .unwrap();
        // Assert
        assert_eq!(
            (
                got.changes[0].file.as_str(),
                got.changes[0].base_version.as_str()
            ),
            ("app.sysml", "a1")
        );
        assert_eq!(applied(&got, APP), text);
        assert!(got.problems.is_empty(), "{:?}", got.problems);
    }

    // --- 境界値 ---

    #[test]
    fn a_request_that_changes_nothing_has_no_changes_but_still_lists_the_problems() {
        // Arrange（同じ名前への変更と、同じ中身への書き換え）
        let same_name = EditRequest::Rename {
            element: "Shop::Cart".into(),
            name: "Cart".into(),
        };
        let same_text = EditRequest::ReplaceText {
            file: "shop.sysml".into(),
            text: SHOP.into(),
        };
        // Act
        let a = run(same_name).unwrap();
        let b = run(same_text).unwrap();
        // Assert
        assert!(a.changes.is_empty() && b.changes.is_empty());
        assert_eq!(messages(&a), ["型「Shop::Nope」が見つかりません（x）"]);
    }

    #[test]
    fn edits_count_utf16_columns() {
        // Arrange（「😀」は UTF-16 で 2 つ）
        let old = "part def A; /* 😀 */ part def B;";
        // Act
        let edits = text_edits(old, "part def A; /* 😀 */ part def C;");
        // Assert
        assert_eq!(edits.len(), 1);
        assert_eq!(
            (
                edits[0].range.start.character,
                edits[0].range.end.character,
                edits[0].new_text.as_str()
            ),
            (30, 31, "C")
        );
    }

    // --- 異常系 ---

    #[test]
    fn refuses_with_the_reason_when_the_element_or_file_is_missing() {
        // Act
        let no_element = run(EditRequest::Delete {
            element: "Shop::Gone".into(),
        });
        let no_parent = run(EditRequest::AddElement {
            kind: "part def".into(),
            name: "A".into(),
            parent: "Nowhere".into(),
        });
        let no_file = run(EditRequest::ReplaceText {
            file: "nope.sysml".into(),
            text: String::new(),
        });
        // Assert
        assert_eq!(
            [no_element, no_parent, no_file].map(|r| r.unwrap_err()),
            [
                "操作する要素「Shop::Gone」が見つかりません。テキストが先に変わった可能性があります",
                "操作する要素「Nowhere」が見つかりません。テキストが先に変わった可能性があります",
                "ファイル「nope.sysml」が見つかりません",
            ]
        );
    }

    #[test]
    fn refuses_with_the_reason_of_the_edit() {
        // Act（使われている名前・扱えない関係の種類）
        let taken = run(EditRequest::Rename {
            element: "Shop::Fast".into(),
            name: "Cart".into(),
        });
        let bogus = run(EditRequest::AddRelation {
            kind: "bogus".into(),
            from: "Shop::Cart".into(),
            to: "Shop::Fast".into(),
        });
        // Assert
        assert_eq!(
            [taken, bogus].map(|r| r.unwrap_err()),
            [
                "「Cart」は既に使われています",
                "関係の種類「bogus」は扱えません"
            ]
        );
    }

    #[test]
    fn relation_words_of_the_contract_become_the_words_of_the_core() {
        // Act
        let got = ["derivation", "composition", "satisfy", "verify"].map(relation_word);
        // Assert
        assert_eq!(got, ["derive", "comp", "satisfy", "verify"]);
    }
}
