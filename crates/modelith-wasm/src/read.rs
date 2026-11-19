//! モデルを読む操作（ADR-0024 の 1。要求 F-AI-1）の wasm の口。Node で動く MCP のサーバが使う。
//!
//! 状態を持たない。呼ぶたびに、プロジェクトのファイル（パスとテキスト）を JSON で受け取り、
//! plugin-sdk の契約の型（`ProjectOutline`・`ElementDetail`）を JSON で返す。中身は `modelith_core::read`。

use modelith_core::read::{self, SourceFile};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

/// 受け取るファイル 1 つ。
#[derive(Deserialize)]
struct FileInput {
    path: String,
    text: String,
}

/// プロジェクトの概要（ファイル・名前のある要素・テキストに書いた図）を JSON で返す。
///
/// 中身は `read_outline_json` に任せる。
///
/// # 引数
///
/// - `files`：`[{ "path", "text" }]` の JSON（パスはプロジェクトのフォルダからの `/` 区切り）
///
/// # 戻り値
///
/// 契約の `ProjectOutline` の JSON。`files` が読めないときは `{ "error": "理由" }`。
///
/// # 例
///
/// ```text
/// readOutline(r#"[{"path":"a.sysml","text":"package P { part def A; }"}]"#)
///   → r#"{"files":[{"path":"a.sysml"}],"elements":[{"qualifiedName":"P",…},{"qualifiedName":"P::A",…}],"diagrams":[]}"#
/// readOutline("x") → r#"{"error":"ファイルの一覧を読み込めませんでした（…）"}"#
/// ```
#[wasm_bindgen(js_name = readOutline)]
pub fn read_outline(files: &str) -> String {
    read_outline_json(files)
}

/// 修飾名で指した要素の詳細を JSON で返す。
///
/// 中身は `read_element_json` に任せる。
///
/// # 引数
///
/// - `files`：`[{ "path", "text" }]` の JSON
/// - `qualified_name`：要素の修飾名（`readOutline` が返す `qualifiedName`）
///
/// # 戻り値
///
/// 契約の `ElementDetail` の JSON。その要素が無ければ `null`。`files` が読めないときは `{ "error": "理由" }`。
///
/// # 例
///
/// ```text
/// readElement(r#"[{"path":"a.sysml","text":"package P { part def A; }"}]"#, "P::A") → r#"{"qualifiedName":"P::A","name":"A","kind":"part def",…}"#
/// readElement(r#"[{"path":"a.sysml","text":"package P { part def A; }"}]"#, "P::B") → "null"
/// ```
#[wasm_bindgen(js_name = readElement)]
pub fn read_element(files: &str, qualified_name: &str) -> String {
    read_element_json(files, qualified_name)
}

/// `readOutline` の本体。
///
/// # 引数
///
/// - `files`：`[{ "path", "text" }]` の JSON
///
/// # 戻り値
///
/// `ProjectOutline` の JSON。`files` が読めないときは `{ "error": "理由" }`。
///
/// # 例
///
/// ```text
/// read_outline_json("[]") → r#"{"files":[],"elements":[],"diagrams":[]}"#
/// read_outline_json("x")  → r#"{"error":"ファイルの一覧を読み込めませんでした（…）"}"#
/// ```
fn read_outline_json(files: &str) -> String {
    with_files(files, |sources| to_json(&read::outline(sources)))
}

/// `readElement` の本体。
///
/// # 引数
///
/// - `files`：`[{ "path", "text" }]` の JSON
/// - `qualified_name`：要素の修飾名
///
/// # 戻り値
///
/// `ElementDetail` の JSON。その要素が無ければ `null`。`files` が読めないときは `{ "error": "理由" }`。
///
/// # 例
///
/// ```text
/// read_element_json("[]", "P::A") → "null"
/// ```
fn read_element_json(files: &str, qualified_name: &str) -> String {
    with_files(files, |sources| {
        to_json(&read::element(sources, qualified_name))
    })
}

/// ファイルの一覧の JSON を読み、コアに渡す形にして `f` を呼ぶ。
///
/// # 引数
///
/// - `files`：`[{ "path", "text" }]` の JSON
/// - `f`：読めたファイルを受け取り、返す JSON を作る関数
///
/// # 戻り値
///
/// `f` の結果。JSON が読めないときは `{ "error": "理由" }`（`f` は呼ばない）。
///
/// # 例
///
/// ```text
/// with_files(r#"[{"path":"a.sysml","text":""}]"#, |s| s.len().to_string()) → "1"
/// with_files("{}", |_| String::new()) → r#"{"error":"ファイルの一覧を読み込めませんでした（…）"}"#
/// ```
fn with_files(files: &str, f: impl FnOnce(&[SourceFile<'_>]) -> String) -> String {
    match serde_json::from_str::<Vec<FileInput>>(files) {
        Ok(inputs) => {
            let sources: Vec<SourceFile<'_>> = inputs
                .iter()
                .map(|i| SourceFile {
                    path: &i.path,
                    text: &i.text,
                })
                .collect();
            f(&sources)
        }
        Err(e) => to_json(&serde_json::json!({
            "error": format!("ファイルの一覧を読み込めませんでした（{e}）")
        })),
    }
}

/// 値を JSON にする。JSON にできないとき（起きない想定）は、そのことを `{ "error" }` で返す。
///
/// # 引数
///
/// - `value`：JSON にする値
///
/// # 戻り値
///
/// JSON の文字列。
///
/// # 例
///
/// ```text
/// to_json(&Some(1))      → "1"
/// to_json(&None::<u8>)   → "null"
/// ```
fn to_json(value: &impl serde::Serialize) -> String {
    serde_json::to_string(value)
        .unwrap_or_else(|_| r#"{"error":"結果を JSON にできませんでした"}"#.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    const FILES: &str =
        r#"[{"path":"a.sysml","text":"package P { part def A { doc /* 説明 */ } }"}]"#;

    // --- 正常系 ---

    #[test]
    fn read_outline_json_returns_the_contract_shape() {
        // Act
        let json = read_outline_json(FILES);
        // Assert
        assert!(
            json.starts_with(r#"{"files":[{"path":"a.sysml"}],"elements":[{"qualifiedName":"P","name":"P","kind":"package","file":"a.sysml","range":{"start":{"line":0,"character":0}"#),
            "{json}"
        );
        assert!(json.ends_with(r#""diagrams":[]}"#), "{json}");
    }

    #[test]
    fn read_element_json_returns_the_detail_or_null() {
        // Act
        let found = read_element_json(FILES, "P::A");
        let missing = read_element_json(FILES, "P::B");
        // Assert
        assert!(
            found.starts_with(
                r#"{"qualifiedName":"P::A","name":"A","kind":"part def","file":"a.sysml""#
            ),
            "{found}"
        );
        assert!(found.contains(r#""doc":"説明""#), "{found}");
        assert_eq!(missing, "null");
    }

    // --- 境界値・異常系 ---

    #[test]
    fn no_files_give_an_empty_outline() {
        // Act
        let json = read_outline_json("[]");
        // Assert
        assert_eq!(json, r#"{"files":[],"elements":[],"diagrams":[]}"#);
    }

    #[test]
    fn unreadable_files_give_an_error_instead_of_a_result() {
        // Arrange（JSON でない・形が違う・項目が足りない）
        let inputs = ["x", "{}", r#"[{"path":"a.sysml"}]"#];
        // Act
        let outlines = inputs.map(read_outline_json);
        let element = read_element_json("x", "P::A");
        // Assert
        for json in outlines.iter().chain([&element]) {
            assert!(
                json.starts_with(r#"{"error":"ファイルの一覧を読み込めませんでした（"#),
                "{json}"
            );
        }
    }
}
