//! モデルを読む操作（ADR-0024 の 1。要求 F-AI-1）。AI のクライアント（MCP）・開いているアプリ・サーバが同じ形で使う。
//!
//! 入力はプロジェクトのファイルのパスとテキストだけで、ファイルの読み書きはしない（呼ぶ側が渡す）。
//! 出力は plugin-sdk の契約の型（`ProjectOutline`・`ElementDetail`・`ProblemReport`。ADR-0024 の 2）。
//! 要素は修飾名（`Shop::Cart`）で指す。名前は、テキストに書ける形（必要なら引用名）にしてつなぐ。

mod problems;
#[cfg(test)]
mod tests;

pub use problems::{PROJECT_FILE, Project, SOURCE, check, problems};

use modelith_plugin_protocol::{
    DiagramSummary, ElementDetail, ElementRelation, ElementSummary, ProjectFile, ProjectOutline,
    Range, RelationDirection,
};

use crate::edit::qualified_name as qualified;
use crate::model::{self, Model};
use crate::plugin_host::{Positions, port};
use crate::project::merge::{merge, parse_file};
use crate::project::text::last_segment;
use crate::project::{Entry, ParseResult};

/// プロジェクトのファイル 1 つ（パスとテキスト）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SourceFile<'a> {
    /// プロジェクトのフォルダからのパス（`/` 区切り）。
    pub path: &'a str,
    /// ファイルのテキスト全体。
    pub text: &'a str,
}

/// 解析できたファイル（大きすぎるファイルは解析しないので、ここに入らない）。
struct Parsed<'a> {
    file: SourceFile<'a>,
    parse: ParseResult,
}

/// プロジェクトの概要（ファイル・名前のある要素・テキストに書いた図）を返す。
///
/// # 引数
///
/// - `files`：プロジェクトのファイル（この順に並べて返す）
///
/// # 戻り値
///
/// ファイルの一覧、名前のある宣言（入れ子も含む。図は除く）の一覧、図（`view`）の一覧。
/// 大きすぎて解析しないファイルは、ファイルの一覧にだけ入る。
///
/// # 例
///
/// ```text
/// outline([shop.sysml「package Shop {\n  part def Cart;\n  view v : GeneralView;\n}」])
///   → files: [shop.sysml]、elements: [Shop（package）, Shop::Cart（part def、1:2–1:16）]、diagrams: [Shop::v（GeneralView）]
/// outline([]) → files・elements・diagrams とも空
/// ```
pub fn outline(files: &[SourceFile<'_>]) -> ProjectOutline {
    let mut out = ProjectOutline {
        files: files
            .iter()
            .map(|f| ProjectFile {
                path: f.path.to_owned(),
            })
            .collect(),
        ..ProjectOutline::default()
    };
    for p in parsed(files) {
        let positions = Positions::new(p.file.text);
        for (i, e) in p.parse.entries.iter().enumerate() {
            if e.name.is_empty() {
                continue;
            }
            let s = summary(&p.parse.entries, i, p.file.path, &positions);
            if is_diagram(e) {
                out.diagrams.push(diagram(s, e));
            } else {
                out.elements.push(s);
            }
        }
    }
    out
}

/// 修飾名で指した要素の詳細（説明・型・工程・直下の要素・ポート・関係）を返す。
/// 関係は、ほかのファイルとつないだモデルから集めるので、ほかのファイルの要素との関係も入る。
///
/// # 引数
///
/// - `files`：プロジェクトのファイル
/// - `qualified_name`：要素の修飾名（`outline` が返す `qualifiedName` と同じ形）
///
/// # 戻り値
///
/// 要素の詳細。その修飾名の要素が無ければ `None`。同じ修飾名が 2 つ以上あれば、最初のもの（ファイルの順、書いた順）。
///
/// # 例
///
/// ```text
/// // shop.sysml「package Shop {\n  requirement def R;\n  part def Cart { doc /* かご */ attribute n : Integer; }\n  satisfy R by Cart;\n}」
/// element(files, "Shop::Cart") → doc: "かご"、members: [Shop::Cart::n（attribute）]、relations: [satisfy outgoing Shop::R]
/// element(files, "Shop::Nope") → None
/// ```
pub fn element(files: &[SourceFile<'_>], qualified_name: &str) -> Option<ElementDetail> {
    let all = parsed(files);
    let (at, index) = all.iter().enumerate().find_map(|(at, p)| {
        (0..p.parse.entries.len())
            .find(|&i| {
                !p.parse.entries[i].name.is_empty()
                    && qualified(&p.parse.entries, i) == qualified_name
            })
            .map(|i| (at, i))
    })?;
    let center = &all[at];
    let positions = Positions::new(center.file.text);
    let entry = &center.parse.entries[index];
    // 中心のファイルの宣言の番号は、つないだあとも変わらない（ほかのファイルは後ろに足す）
    let others = all
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != at)
        .map(|(_, p)| p.parse.clone())
        .collect();
    let whole = merge(center.parse.clone(), others);
    let model = model::build_whole(&whole);
    let node = model.nodes.iter().find(|n| n.entry == index);
    Some(ElementDetail {
        summary: summary(&center.parse.entries, index, center.file.path, &positions),
        doc: entry.doc_text.clone().or_else(|| entry.doc.clone()),
        element_type: (!entry.ty.is_empty()).then(|| entry.ty.clone()),
        phase: node.and_then(|n| n.phase.clone()),
        members: entry
            .children
            .iter()
            .filter(|&&c| {
                center
                    .parse
                    .entries
                    .get(c)
                    .is_some_and(|e| !e.name.is_empty())
            })
            .map(|&c| summary(&center.parse.entries, c, center.file.path, &positions))
            .collect(),
        ports: node.map_or_else(Vec::new, |n| n.ports.iter().map(port).collect()),
        relations: node.map_or_else(Vec::new, |n| relations(&model, &whole, &n.key)),
    })
}

/// ファイルを解析する。大きすぎるファイル（`parse_file` が `None` を返すもの）は除く。
///
/// # 引数
///
/// - `files`：プロジェクトのファイル
///
/// # 戻り値
///
/// 解析できたファイルと解析結果（渡した順）。
///
/// # 例
///
/// ```text
/// parsed([a.sysml「part def A;」]) → [a.sysml（entries は [A]）]
/// ```
fn parsed<'a>(files: &[SourceFile<'a>]) -> Vec<Parsed<'a>> {
    files
        .iter()
        .filter_map(|&file| parse_file(file.text).map(|parse| Parsed { file, parse }))
        .collect()
}

/// 宣言の概要を作る。
///
/// # 引数
///
/// - `entries`：そのファイルの宣言
/// - `i`：宣言の番号（範囲の中であること）
/// - `file`：ファイルのパス
/// - `positions`：そのファイルのテキストの位置の変換表
///
/// # 戻り値
///
/// 修飾名・名前・短い名前（あれば）・種類・ファイル・範囲。
///
/// # 例
///
/// ```text
/// summary(「package P {\n  part def <C1> Cart;\n}」の Cart) → { qualifiedName: "P::Cart", name: "Cart", shortName: "C1", kind: "part def", range: 1:2–1:21 }
/// ```
fn summary(entries: &[Entry], i: usize, file: &str, positions: &Positions<'_>) -> ElementSummary {
    let e = &entries[i];
    ElementSummary {
        qualified_name: qualified(entries, i),
        name: e.name.clone(),
        short_name: (!e.short.is_empty()).then(|| e.short.clone()),
        kind: e.kind.clone(),
        file: file.to_owned(),
        range: Range {
            start: positions.position(e.start),
            end: positions.position(e.end),
        },
    }
}

/// テキストに書いた図（`view` の用法）か。`view def` は図の定義なので、要素として扱う。
///
/// # 引数
///
/// - `e`：宣言
///
/// # 戻り値
///
/// `view` の用法なら true。
///
/// # 例
///
/// ```text
/// is_diagram(view v : GeneralView) → true
/// is_diagram(view def V)           → false
/// ```
fn is_diagram(e: &Entry) -> bool {
    e.kind == "view"
}

/// 図の概要を作る。種類は view の型の名前の最後の部分（型を書いていなければ `view`）。
///
/// # 引数
///
/// - `s`：その view の宣言の概要
/// - `e`：その view の宣言
///
/// # 戻り値
///
/// 図の概要。
///
/// # 例
///
/// ```text
/// diagram(Shop::v の概要, view v : Views::GeneralView) → { name: "v", qualifiedName: "Shop::v", kind: "GeneralView", … }
/// diagram(Shop::w の概要, view w)                      → kind: "view"
/// ```
fn diagram(s: ElementSummary, e: &Entry) -> DiagramSummary {
    let ty = last_segment(&e.ty);
    DiagramSummary {
        name: s.name,
        qualified_name: s.qualified_name,
        kind: if ty.is_empty() { "view" } else { ty }.to_owned(),
        file: s.file,
        range: s.range,
    }
}

/// 要素から出る関係と、要素に入る関係を集める（モデルの線の順）。
///
/// # 引数
///
/// - `model`：つないだモデル
/// - `whole`：つないだ解析結果（相手の修飾名を作る）
/// - `key`：要素のキー
///
/// # 戻り値
///
/// 関係（種類・向き・相手の修飾名）。相手がモデルの要素でなければ、相手はキーのまま。
///
/// # 例
///
/// ```text
/// // 「package P { requirement def R; part def A; satisfy R by A; }」
/// relations(model, whole, "A") → [{ kind: "satisfy", direction: outgoing, other: "P::R" }]
/// relations(model, whole, "R") → [{ kind: "satisfy", direction: incoming, other: "P::A" }]
/// ```
fn relations(model: &Model, whole: &ParseResult, key: &str) -> Vec<ElementRelation> {
    let name_of = |k: &str| {
        model
            .nodes
            .iter()
            .find(|n| n.key == k)
            .map_or_else(|| k.to_owned(), |n| qualified(&whole.entries, n.entry))
    };
    model
        .edges
        .iter()
        .filter_map(|e| {
            let (direction, other) = if e.from == key {
                (RelationDirection::Outgoing, &e.to)
            } else if e.to == key {
                (RelationDirection::Incoming, &e.from)
            } else {
                return None;
            };
            Some(ElementRelation {
                kind: relation_word(e.kind).to_owned(),
                direction,
                other: name_of(other),
            })
        })
        .collect()
}

/// モデルの線の種類を、契約の言葉にする。契約の `RelationKind` にあるものは同じ言葉、それ以外は camelCase の言葉。
///
/// # 引数
///
/// - `kind`：モデルの線の種類
///
/// # 戻り値
///
/// 契約の言葉。言い換えの無い種類はそのまま。
///
/// # 例
///
/// ```text
/// relation_word("derive")  → "derivation"
/// relation_word("comp")    → "composition"
/// relation_word("defined") → "definedBy"
/// relation_word("satisfy") → "satisfy"
/// ```
fn relation_word(kind: &str) -> &str {
    match kind {
        "derive" => "derivation",
        "comp" => "composition",
        "defined" => "definedBy",
        other => other,
    }
}
