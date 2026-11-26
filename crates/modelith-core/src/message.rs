//! 利用者に見せる文を、言語によらない「種類のコードと値」で表す（ADR-0027 §3）。
//!
//! コアは文を作らず、`Message` を返す。文にするのは文言の層（`modelith-messages`）で、
//! 入口（wasm・CLI）が `set_renderer` でつなぐ。コアは文言の層にも辞書にも依存しない。
//!
//! 外から届いた文（プラグインのルールの文・OS の失敗の理由）と、まだ辞書に移していない文は、
//! `Message::verbatim` でそのまま運ぶ。

use std::fmt;
use std::sync::RwLock;

use serde::{Serialize, Serializer};

/// そのまま出す文のコード（値は `text` の 1 つ）。
pub const VERBATIM: &str = "verbatim";

/// そのまま出す文の、値の名前。
const VERBATIM_TEXT: &str = "text";

/// 利用者に見せる文 1 つ。種類のコードと、差し込む値の並び。
///
/// 等しさ（`==`）は、`Message` どうしならコードと値を比べ、文字列となら文にしたもの（`render`）を比べる。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Message {
    /// 種類のコード（例：`read-error.eof`）。辞書のキーは、`.` を `-` に替えたもの。
    pub code: &'static str,
    /// 差し込む値（名前と値。足した順）。
    pub args: Vec<(&'static str, Arg)>,
}

/// 文に差し込む値。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Arg {
    /// 文字のまま差し込む値（名前・数を文字にしたものなど）。
    Text(String),
    /// 別の文（「ルール「id」：<別の文>」のように、文の中に文を入れる）。
    Message(Message),
}

/// `Message` を文にする関数（文言の層が用意する）。
pub type Renderer = fn(&Message) -> String;

/// 入口が入れた、文にする関数。入れていなければ None（コアのテストは入れない）。
static RENDERER: RwLock<Option<Renderer>> = RwLock::new(None);

/// `Message` を文にする関数を入れる。入口（wasm・CLI）が、始めに 1 回呼ぶ。後から呼んだものが使われる。
///
/// # 引数
///
/// - `renderer`：文にする関数（`modelith_messages::render`）
///
/// # 戻り値
///
/// なし。以後の `Message::render`（`Display`・`Serialize`・文字列との比較を含む）が、この関数を使う。
pub fn set_renderer(renderer: Renderer) {
    let mut slot = match RENDERER.write() {
        Ok(slot) => slot,
        Err(poisoned) => poisoned.into_inner(),
    };
    *slot = Some(renderer);
}

/// 入口が入れた、文にする関数を返す。
///
/// # 戻り値
///
/// 入れた関数。入れていなければ None。
///
/// # 例
///
/// ```text
/// installed()                                  → None            // 何も入れていない
/// set_renderer(f); installed()                 → Some(f)
/// ```
fn installed() -> Option<Renderer> {
    match RENDERER.read() {
        Ok(slot) => *slot,
        Err(poisoned) => *poisoned.into_inner(),
    }
}

impl Message {
    /// 値の無い文を作る。値は `arg`・`arg_message` で足す。
    ///
    /// # 引数
    ///
    /// - `code`：種類のコード（`<場所>.<種類>`。小文字の英字・数字・`-` と、区切りの `.`）
    ///
    /// # 戻り値
    ///
    /// そのコードの、値の無い文。
    ///
    /// # 例
    ///
    /// ```text
    /// Message::new("read-error.eof") → Message { code: "read-error.eof", args: [] }
    /// ```
    pub fn new(code: &'static str) -> Self {
        Self {
            code,
            args: Vec::new(),
        }
    }

    /// 文字の値を足す。
    ///
    /// # 引数
    ///
    /// - `name`：値の名前（英字と数字。辞書の `{ $name }` に当たる）
    /// - `value`：差し込む文字。数は、呼ぶ側で文字にしてから渡す（ADR-0027 §2）
    ///
    /// # 戻り値
    ///
    /// 値を足した文。
    ///
    /// # 例
    ///
    /// ```text
    /// Message::new("ref.missing").arg("name", "X")
    ///   → Message { code: "ref.missing", args: [("name", Text("X"))] }
    /// ```
    #[must_use]
    pub fn arg(mut self, name: &'static str, value: impl Into<String>) -> Self {
        self.args.push((name, Arg::Text(value.into())));
        self
    }

    /// 別の文を、値として足す。
    ///
    /// # 引数
    ///
    /// - `name`：値の名前
    /// - `value`：中に入れる文
    ///
    /// # 戻り値
    ///
    /// 値を足した文。
    ///
    /// # 例
    ///
    /// ```text
    /// Message::new("read-error.format").arg_message("reason", Message::new("read-error.eof"))
    ///   → Message { code: "read-error.format", args: [("reason", Message(read-error.eof))] }
    /// ```
    #[must_use]
    pub fn arg_message(mut self, name: &'static str, value: Message) -> Self {
        self.args.push((name, Arg::Message(value)));
        self
    }

    /// そのまま出す文を作る。外から届いた文（プラグインのルールの文・OS の失敗の理由）と、まだ辞書に移していない文に使う。
    ///
    /// # 引数
    ///
    /// - `text`：出す文
    ///
    /// # 戻り値
    ///
    /// コードが `verbatim`、値が `text` 1 つの文。
    ///
    /// # 例
    ///
    /// ```text
    /// Message::verbatim("そのまま").render() → "そのまま"
    /// Message::verbatim("").render()         → ""
    /// ```
    pub fn verbatim(text: impl Into<String>) -> Self {
        Self::new(VERBATIM).arg(VERBATIM_TEXT, text)
    }

    /// そのまま出す文なら、その文を返す。
    ///
    /// # 戻り値
    ///
    /// `verbatim` で作った文なら、その文。ほかのコードの文なら None。
    ///
    /// # 例
    ///
    /// ```text
    /// Message::verbatim("x").verbatim_text()        → Some("x")
    /// Message::new("read-error.eof").verbatim_text() → None
    /// ```
    pub fn verbatim_text(&self) -> Option<&str> {
        match self.args.as_slice() {
            [(VERBATIM_TEXT, Arg::Text(text))] if self.code == VERBATIM => Some(text),
            _ => None,
        }
    }

    /// 文にする。入口が入れた関数（`set_renderer`）を使い、入れていなければ `fallback` の形にする。
    ///
    /// # 戻り値
    ///
    /// 利用者に見せる文。
    ///
    /// # 例
    ///
    /// ```text
    /// // 文言の層を入れた入口（wasm・CLI）
    /// Message::new("read-error.eof").render() → "途中で終わっています。閉じる括弧や「"」が足りません"
    /// // 入れていないとき（コアのテスト）
    /// Message::new("read-error.eof").render() → "read-error.eof{}"
    /// Message::verbatim("そのまま").render()   → "そのまま"
    /// ```
    pub fn render(&self) -> String {
        match installed() {
            Some(renderer) => renderer(self),
            None => self.fallback(),
        }
    }

    /// 辞書を使わない、決まった形の文にする。文言の層が入っていないときと、辞書にキーが無いときに使う。
    ///
    /// # 戻り値
    ///
    /// そのまま出す文なら、その文。ほかは `コード{名前=値, 名前=値}`（中の文も同じ形）。
    ///
    /// # 例
    ///
    /// ```text
    /// Message::verbatim("そのまま").fallback()                 → "そのまま"
    /// Message::new("ref.missing").arg("name", "X").fallback() → "ref.missing{name=X}"
    /// Message::new("read-error.eof").fallback()               → "read-error.eof{}"   // 値が無い
    /// Message::new("a.b").arg_message("why", Message::new("c.d").arg("n", "1")).fallback()
    ///   → "a.b{why=c.d{n=1}}"
    /// ```
    pub fn fallback(&self) -> String {
        if let Some(text) = self.verbatim_text() {
            return text.to_owned();
        }
        let texts: Vec<(&str, String)> = self
            .args
            .iter()
            .map(|(name, value)| match value {
                Arg::Text(text) => (*name, text.clone()),
                Arg::Message(message) => (*name, message.fallback()),
            })
            .collect();
        let args: Vec<(&str, &str)> = texts.iter().map(|(n, t)| (*n, t.as_str())).collect();
        fallback_text(self.code, &args)
    }
}

/// コードと値から、辞書を使わない決まった形の文を作る（`Message::fallback` の中身。文言の層も、辞書にキーが無いときに使う）。
///
/// # 引数
///
/// - `code`：種類のコード
/// - `args`：値の名前と、文字にした値（足した順）
///
/// # 戻り値
///
/// `コード{名前=値, 名前=値}`。値が無ければ `コード{}`。
///
/// # 例
///
/// ```text
/// fallback_text("ref.missing", &[("name", "X"), ("kind", "part")]) → "ref.missing{name=X, kind=part}"
/// fallback_text("read-error.eof", &[])                             → "read-error.eof{}"
/// ```
pub fn fallback_text(code: &str, args: &[(&str, &str)]) -> String {
    let args: Vec<String> = args
        .iter()
        .map(|(name, value)| format!("{name}={value}"))
        .collect();
    format!("{code}{{{}}}", args.join(", "))
}

impl fmt::Display for Message {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.render())
    }
}

/// JSON には、文にしたものを書く（wasm・CLI の出力の形を変えない）。
impl Serialize for Message {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.render())
    }
}

impl PartialEq<str> for Message {
    fn eq(&self, other: &str) -> bool {
        self.render() == other
    }
}

impl PartialEq<&str> for Message {
    fn eq(&self, other: &&str) -> bool {
        self.render() == *other
    }
}

impl PartialEq<String> for Message {
    fn eq(&self, other: &String) -> bool {
        self.render() == *other
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // このモジュールのテストは `set_renderer` を呼ばない（テストは並んで動き、入れた関数は全体で 1 つのため）。

    #[test]
    fn new_has_the_code_and_no_args() {
        // Act（境界値：値が無い）
        let message = Message::new("read-error.eof");
        // Assert
        assert_eq!(message.code, "read-error.eof");
        assert_eq!(message.args, []);
    }

    #[test]
    fn args_are_kept_in_the_order_added() {
        // Act
        let message = Message::new("a.b")
            .arg("name", "X")
            .arg_message("why", Message::new("c.d"))
            .arg("count", 2.to_string());
        // Assert
        assert_eq!(
            message.args,
            [
                ("name", Arg::Text("X".to_owned())),
                ("why", Arg::Message(Message::new("c.d"))),
                ("count", Arg::Text("2".to_owned())),
            ]
        );
    }

    #[test]
    fn verbatim_carries_the_text_as_its_only_arg() {
        // Act
        let message = Message::verbatim("そのまま");
        // Assert
        assert_eq!(message.code, VERBATIM);
        assert_eq!(message.args, [("text", Arg::Text("そのまま".to_owned()))]);
        assert_eq!(message.verbatim_text(), Some("そのまま"));
    }

    #[test]
    fn verbatim_text_is_none_for_other_codes_and_shapes() {
        // Arrange（異常系：コードが違う・値の名前が違う・値が文）
        let other_code = Message::new("a.b").arg("text", "x");
        let other_name = Message::new(VERBATIM).arg("body", "x");
        let nested = Message::new(VERBATIM).arg_message("text", Message::verbatim("x"));
        // Act
        let got = [
            other_code.verbatim_text(),
            other_name.verbatim_text(),
            nested.verbatim_text(),
        ];
        // Assert
        assert_eq!(got, [None, None, None]);
    }

    #[test]
    fn fallback_of_verbatim_is_the_text() {
        // Arrange（境界値：空の文と、括弧を含む文）
        let empty = Message::verbatim("");
        let braces = Message::verbatim("{ } と書いてください");
        // Act
        let got = [empty.fallback(), braces.fallback()];
        // Assert
        assert_eq!(got, ["", "{ } と書いてください"]);
    }

    #[test]
    fn fallback_lists_the_code_and_the_args() {
        // Arrange
        let message = Message::new("ref.missing")
            .arg("name", "X")
            .arg("kind", "part");
        // Act
        let text = message.fallback();
        // Assert
        assert_eq!(text, "ref.missing{name=X, kind=part}");
    }

    #[test]
    fn fallback_without_args_has_empty_braces() {
        // Act（境界値：値が無い）
        let text = Message::new("read-error.eof").fallback();
        // Assert
        assert_eq!(text, "read-error.eof{}");
    }

    #[test]
    fn fallback_text_formats_flat_values() {
        // Act（値が 2 つ・値が無い）
        let got = [
            fallback_text("ref.missing", &[("name", "X"), ("kind", "part")]),
            fallback_text("read-error.eof", &[]),
        ];
        // Assert
        assert_eq!(got, ["ref.missing{name=X, kind=part}", "read-error.eof{}"]);
    }

    #[test]
    fn fallback_renders_nested_messages_the_same_way() {
        // Arrange（中の文が、値のある文と、そのまま出す文）
        let message = Message::new("a.b")
            .arg_message("why", Message::new("c.d").arg("n", "1"))
            .arg_message("raw", Message::verbatim("外の文"));
        // Act
        let text = message.fallback();
        // Assert
        assert_eq!(text, "a.b{why=c.d{n=1}, raw=外の文}");
    }

    #[test]
    fn render_and_display_use_the_fallback_when_no_renderer_is_installed() {
        // Arrange
        let message = Message::new("ref.missing").arg("name", "X");
        // Act
        let got = [message.render(), message.to_string()];
        // Assert
        assert_eq!(got, ["ref.missing{name=X}", "ref.missing{name=X}"]);
    }

    #[test]
    fn serializes_as_the_rendered_string() {
        // Arrange
        let messages = [
            Message::verbatim("「A」は既に使われています"),
            Message::new("ref.missing").arg("name", "X"),
        ];
        // Act
        let json = serde_json::to_string(&messages).unwrap_or_default();
        // Assert
        assert_eq!(
            json,
            r#"["「A」は既に使われています","ref.missing{name=X}"]"#
        );
    }

    #[test]
    fn compares_with_strings_by_the_rendered_text() {
        // Arrange
        let message = Message::verbatim("そのまま");
        // Act & Assert（&str・str・String のどれとも比べられる）
        assert_eq!(message, "そのまま");
        assert_eq!(message, *"そのまま");
        assert_eq!(message, "そのまま".to_owned());
        assert_ne!(message, "ほかの文");
    }

    #[test]
    fn compares_with_messages_by_code_and_args() {
        // Arrange（文にすると同じでも、コードが違えば別の文）
        let verbatim = Message::verbatim("a.b{}");
        let coded = Message::new("a.b");
        // Act
        let same_text = verbatim.render() == coded.render();
        // Assert
        assert!(same_text);
        assert_ne!(verbatim, coded);
        assert_eq!(coded, Message::new("a.b"));
    }
}
