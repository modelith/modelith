//! 文言の層（`modelith-messages`）を、コアにつなぐ（ADR-0027 §3）。
//!
//! コアは問題や断りを「種類のコードと値」で返す。この入口が、文言の層を文にする関数として入れ、
//! JSON に書くときに辞書の文になる。依存の向きは「入口 → 文言の層 → コア」。

use std::collections::BTreeMap;
use std::sync::Once;

use wasm_bindgen::prelude::*;

/// 文にする関数を、1 回だけ入れるための印。
static INSTALL: Once = Once::new();

/// 文言の層を、コアの文にする関数として入れる（初めの 1 回だけ。2 回目からは何もしない）。
/// コアの結果を JSON にする関数が、始めに呼ぶ。
///
/// # 戻り値
///
/// なし。以後、コアの `Message` は日本語の辞書で文になる。
pub(crate) fn install_renderer() {
    INSTALL.call_once(|| modelith_core::message::set_renderer(modelith_messages::render));
}

/// コードと値を、文言の層の辞書で文にする。
/// 同じ辞書と値を Rust と TypeScript の Fluent の実装に通し、同じ文になることを確かめるための口（ADR-0027 §6）。
///
/// # 引数
///
/// - `code`：種類のコード（`read-error.eof` など）。辞書のキー（`read-error-eof`）でもよい
/// - `args_json`：値の JSON（`{ "名前": "文字の値" }` の平らな形。数も文字で渡す）
///
/// # 戻り値
///
/// 文。辞書に無いコードは `コード{名前=値}` の形。`args_json` がその形でなければ、例外を投げる。
///
/// # 例
///
/// ```text
/// renderMessage("read-error.settings", r#"{"reason":"理由"}"#) → "設定を読み込めませんでした（理由）"
/// renderMessage("read-error.eof", "{}")                        → "途中で終わっています。閉じる括弧や「"」が足りません"
/// renderMessage("no.such", r#"{"name":"X"}"#)                  → "no.such{name=X}"
/// renderMessage("read-error.eof", "[1]")                       → 例外
/// ```
#[wasm_bindgen(js_name = renderMessage)]
pub fn render_message(code: &str, args_json: &str) -> Result<String, JsError> {
    render_message_text(code, args_json).map_err(|e| JsError::new(&e.to_string()))
}

/// コードと値の JSON を、文言の層の辞書で文にする（`render_message` の中身）。
///
/// # 引数
///
/// - `code`：種類のコード
/// - `args_json`：値の JSON（文字の値だけの、平らなオブジェクト）
///
/// # 戻り値
///
/// 文。`args_json` が文字の値だけのオブジェクトでなければ、読み取りの失敗（`Err`）。
///
/// # 例
///
/// ```text
/// render_message_text("read-error.settings", r#"{"reason":"理由"}"#) → Ok("設定を読み込めませんでした（理由）")
/// render_message_text("read-error.eof", r#"{"n":1}"#)                → Err(…)   // 値が文字でない
/// ```
fn render_message_text(code: &str, args_json: &str) -> Result<String, serde_json::Error> {
    let args: BTreeMap<String, String> = serde_json::from_str(args_json)?;
    let args: Vec<(String, String)> = args.into_iter().collect();
    Ok(modelith_messages::render_code(code, &args))
}

#[cfg(test)]
mod tests {
    use super::*;
    use modelith_core::Message;

    #[test]
    fn install_renderer_makes_core_messages_japanese() {
        // Arrange
        let message = Message::new("read-error.settings")
            .arg_message("reason", Message::new("read-error.expected-value"));
        // Act（2 回呼んでも同じ）
        install_renderer();
        install_renderer();
        // Assert（文にしたものも、JSON に書いたものも辞書の文）
        let text = "設定を読み込めませんでした（値がありません）";
        assert_eq!(message.render(), text);
        assert_eq!(
            serde_json::to_string(&message).unwrap_or_default(),
            format!("\"{text}\"")
        );
    }

    #[test]
    fn render_message_text_fills_the_values() {
        // Arrange（値あり・値なし・値に辞書の書き方や HTML に見える文字）
        let cases = [
            ("read-error.settings", r#"{"reason":"理由"}"#),
            ("read-error.eof", "{}"),
            ("read-error.settings", r#"{"reason":"{ $x } <b>"}"#),
        ];
        // Act
        let got: Vec<String> = cases
            .iter()
            .map(|(code, args)| render_message_text(code, args).unwrap_or_default())
            .collect();
        // Assert
        assert_eq!(
            got,
            [
                "設定を読み込めませんでした（理由）",
                "途中で終わっています。閉じる括弧や「\"」が足りません",
                "設定を読み込めませんでした（{ $x } <b>）",
            ]
        );
    }

    #[test]
    fn render_message_text_falls_back_for_unknown_codes_and_missing_values() {
        // Arrange（異常系：辞書に無いコード・文が使う値が無い）
        let cases = [
            ("no.such", r#"{"name":"X","kind":"part"}"#),
            ("read-error.settings", "{}"),
        ];
        // Act
        let got: Vec<String> = cases
            .iter()
            .map(|(code, args)| render_message_text(code, args).unwrap_or_default())
            .collect();
        // Assert（値は名前の順）
        assert_eq!(got, ["no.such{kind=part, name=X}", "read-error.settings{}"]);
    }

    #[test]
    fn render_message_text_refuses_values_that_are_not_a_flat_object_of_strings() {
        // Arrange（異常系：並び・文字でない値・入れ子・JSON でない）
        let cases = ["[1]", r#"{"n":1}"#, r#"{"a":{"b":"c"}}"#, "{"];
        // Act
        let failed: Vec<bool> = cases
            .iter()
            .map(|args| render_message_text("read-error.eof", args).is_err())
            .collect();
        // Assert
        assert_eq!(failed, [true, true, true, true]);
    }
}
