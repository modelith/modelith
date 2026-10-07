//! ブラウザ向けの wasm バインディング。Web Worker 内で読み込まれ、
//! UI とは LSP と同じ形のメッセージでやり取りする（ADR-0003）。

use wasm_bindgen::prelude::*;

/// コアのバージョンを返す。
#[wasm_bindgen]
pub fn version() -> String {
    modelith_core::VERSION.to_owned()
}
