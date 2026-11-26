//! モデルを書く操作のうち、提案を作る部分（ADR-0024 の 1・4。要求 F-AI-2）の wasm の口。Node で動く MCP のサーバが使う。
//!
//! 状態を持たず、何も書かない。プロジェクトのファイル（パス・テキスト・版）と編集の意図（契約の `EditRequest`）を JSON で受け取り、
//! 契約の `EditProposal` を JSON で返す。中身は `modelith_core::write`。

use std::collections::BTreeMap;

use modelith_core::Message;
use modelith_core::write::{self, EditRequest, VersionedFile, Workspace};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

use crate::messages::install_renderer;
use crate::read::to_json;

/// 受け取るファイル 1 つ。
#[derive(Deserialize)]
struct FileInput {
    path: String,
    text: String,
    version: String,
}

/// 編集の意図を当てた提案を JSON で返す（何も書かない）。
///
/// 中身は `propose_edit_json` に任せる。
///
/// # 引数
///
/// - `files`：`[{ "path", "text", "version" }]` の JSON（`version` は呼ぶ側が決める版。提案の `baseVersion` にそのまま入る）
/// - `project_file`：プロジェクトの設定ファイル（`modelith.json`）のテキスト。無ければ `undefined`
/// - `plugin_files`：`{ "<プラグインの ID>": { "<相対パス>": "<テキスト>" } }` の JSON（無ければ `{}`）
/// - `request`：契約の `EditRequest` の JSON
///
/// # 戻り値
///
/// 契約の `EditProposal` の JSON。意図を当てられないときは `{ "refused": "理由" }`、入力が読めないときは `{ "error": "理由" }`。
///
/// # 例
///
/// ```text
/// proposeEdit(r#"[{"path":"a.sysml","text":"package P { part def A; }","version":"v1"}]"#, undefined, "{}", r#"{"type":"rename","element":"P::A","name":"B"}"#)
///   → r#"{"changes":[{"file":"a.sysml","baseVersion":"v1","edits":[{"range":{…},"newText":"B"}]}],"problems":[]}"#
/// proposeEdit(同じファイル, undefined, "{}", r#"{"type":"delete","element":"P::Nope"}"#)
///   → r#"{"refused":"操作する要素「P::Nope」が見つかりません。テキストが先に変わった可能性があります"}"#
/// ```
#[wasm_bindgen(js_name = proposeEdit)]
pub fn propose_edit(
    files: &str,
    project_file: Option<String>,
    plugin_files: &str,
    request: &str,
) -> String {
    propose_edit_json(files, project_file.as_deref(), plugin_files, request)
}

/// `proposeEdit` の本体。
///
/// # 引数
///
/// - `files`：`[{ "path", "text", "version" }]` の JSON
/// - `project_file`：設定ファイルのテキスト（無ければ `None`）
/// - `plugin_files`：プラグインの ID → 相対パス → テキストの JSON
/// - `request`：契約の `EditRequest` の JSON
///
/// # 戻り値
///
/// `EditProposal` の JSON。当てられないときは `{ "refused": "理由" }`、入力が読めないときは `{ "error": "理由" }`。
///
/// # 例
///
/// ```text
/// propose_edit_json("[]", None, "{}", r#"{"type":"delete","element":"P::A"}"#) → r#"{"refused":"操作する要素「P::A」が見つかりません。…"}"#
/// propose_edit_json("[]", None, "{}", "x")                                     → r#"{"error":"編集の意図を読み込めませんでした（…）"}"#
/// ```
fn propose_edit_json(
    files: &str,
    project_file: Option<&str>,
    plugin_files: &str,
    request: &str,
) -> String {
    install_renderer();
    let inputs = match serde_json::from_str::<Vec<FileInput>>(files) {
        Ok(i) => i,
        Err(e) => return error_json("ファイルの一覧", &e),
    };
    let plugin_files =
        match serde_json::from_str::<BTreeMap<String, BTreeMap<String, String>>>(plugin_files) {
            Ok(p) => p,
            Err(e) => return error_json("プラグインのファイル", &e),
        };
    let request = match serde_json::from_str::<EditRequest>(request) {
        Ok(r) => r,
        Err(e) => return error_json("編集の意図", &e),
    };
    let versioned: Vec<VersionedFile<'_>> = inputs
        .iter()
        .map(|i| VersionedFile {
            path: &i.path,
            text: &i.text,
            version: &i.version,
        })
        .collect();
    let workspace = Workspace {
        files: &versioned,
        project_file,
        plugin_files: &plugin_files,
    };
    match write::propose(&workspace, &request) {
        Ok(proposal) => to_json(&proposal),
        Err(reason) => to_json(&serde_json::json!({ "refused": reason })),
    }
}

/// 入力が読めなかったことを伝える JSON を作る。
///
/// # 引数
///
/// - `what`：読めなかったもの（文の先頭に入れる）
/// - `e`：JSON の読み取りのエラー
///
/// # 戻り値
///
/// `{ "error": "<what>を読み込めませんでした（理由）" }`。
///
/// # 例
///
/// ```text
/// error_json("編集の意図", &e) → r#"{"error":"編集の意図を読み込めませんでした（expected value at line 1 column 1）"}"#
/// ```
fn error_json(what: &str, e: &serde_json::Error) -> String {
    to_json(
        &serde_json::json!({ "error": Message::verbatim(format!("{what}を読み込めませんでした（{e}）")) }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const FILES: &str = r#"[{"path":"a.sysml","text":"package P { part def A; }","version":"v1"}]"#;

    // --- 正常系 ---

    #[test]
    fn returns_the_proposal_in_the_contract_shape() {
        // Act
        let json = propose_edit_json(
            FILES,
            None,
            "{}",
            r#"{"type":"rename","element":"P::A","name":"B"}"#,
        );
        // Assert
        assert_eq!(
            json,
            r#"{"changes":[{"file":"a.sysml","baseVersion":"v1","edits":[{"range":{"start":{"line":0,"character":21},"end":{"line":0,"character":22}},"newText":"B"}]}],"problems":[]}"#
        );
    }

    #[test]
    fn uses_the_project_file_for_the_problems_after_the_change() {
        // Arrange（有効にしたプラグインのファイルが無い → 当てたあとの問題一覧に出る）
        let project = r#"{ "plugins": { "jp.x": {} } }"#;
        // Act
        let json = propose_edit_json(
            FILES,
            Some(project),
            "{}",
            r#"{"type":"setDoc","element":"P::A","doc":"説明"}"#,
        );
        // Assert
        assert!(
            json.starts_with(r#"{"changes":[{"file":"a.sysml","baseVersion":"v1""#),
            "{json}"
        );
        assert!(
            json.contains(r#""file":".modelith/plugins/jp.x/modelith-plugin.json""#),
            "{json}"
        );
    }

    // --- 異常系 ---

    #[test]
    fn a_request_that_cannot_be_applied_is_refused_with_the_reason() {
        // Act
        let json = propose_edit_json(
            FILES,
            None,
            "{}",
            r#"{"type":"delete","element":"P::Nope"}"#,
        );
        // Assert
        assert_eq!(
            json,
            r#"{"refused":"操作する要素「P::Nope」が見つかりません。テキストが先に変わった可能性があります"}"#
        );
    }

    #[test]
    fn unreadable_inputs_give_an_error_that_names_the_input() {
        // Arrange（版の無いファイル・JSON でないプラグイン・知らない種類の意図）
        let request = r#"{"type":"delete","element":"P::A"}"#;
        // Act
        let files = propose_edit_json(r#"[{"path":"a.sysml","text":""}]"#, None, "{}", request);
        let plugins = propose_edit_json(FILES, None, "x", request);
        let unknown = propose_edit_json(FILES, None, "{}", r#"{"type":"explode"}"#);
        // Assert
        assert!(
            files.starts_with(r#"{"error":"ファイルの一覧を読み込めませんでした（"#),
            "{files}"
        );
        assert!(
            plugins.starts_with(r#"{"error":"プラグインのファイルを読み込めませんでした（"#),
            "{plugins}"
        );
        assert!(
            unknown.starts_with(r#"{"error":"編集の意図を読み込めませんでした（"#),
            "{unknown}"
        );
    }
}
