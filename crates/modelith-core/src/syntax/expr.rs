//! 式の文法の確かめ（KerML 8.2.5.8 Expressions Concrete Syntax。ADR-0015 の段階 B のうち、構文として正しいかを見るところ）。
//!
//! 式のトークンの並びを文法どおりにたどり、**確かに壊れている**ところだけを知らせる：
//! 演算子の後に値が無い（`1 +`）、値の間に演算子が無い（`1 2`）、カンマの前後に値が無い（`f(,)`）、
//! `if` の式に `?`・`else` が無い、`.`・`->` の後に名前が無い。
//!
//! 評価はしない。式の中の名前が見つかるかも確かめない（標準ライブラリを同梱していないため。0.5.0 以降）。
//! 演算子の優先順位も見ない（正しいかどうかの判定には要らないため）。
//! 知らない語や記号に出会ったら、誤って知らせないよう、そこで確かめるのをやめる（正しい式を「壊れている」と言わない。F-EDIT-8）。

use super::kind::SyntaxKind::{self, *};
use crate::Message;

/// 式のトークン 1 つ（空白とコメントを除いたもの）。
#[derive(Debug, Clone, Copy)]
pub(crate) struct Tok<'t> {
    pub kind: SyntaxKind,
    pub text: &'t str,
}

/// 式の壊れているところ。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Fault {
    /// 何番めのトークンか（0 始まり）。
    pub at: usize,
    /// そのトークンの後ろを指すか（「〜の後に値がありません」）。偽なら、そのトークンの頭を指す。
    pub after: bool,
    /// 知らせる文。
    pub message: Message,
}

/// たどるのをやめる理由。
enum Stop {
    /// 壊れている。
    Fault(Fault),
    /// 知らない語や記号に出会った（壊れているとは言えない）。
    Unknown,
}

type Step = Result<(), Stop>;

/// 次のトークンが、値の始まりとして何に当たるか。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Next {
    /// 値が始まる。
    Operand,
    /// 値が無い（式の終わり・閉じ括弧・カンマ・2 項の演算子など）。
    Missing,
    /// 知らない語や記号。
    Unknown,
}

/// 式のトークンの並びを確かめる。
///
/// # 引数
///
/// - `toks`：式のトークン（書いた順。空白とコメントは除く）
///
/// # 戻り値
///
/// 確かに壊れているところがあれば、最初の 1 つ。無ければ（または、知らない語や記号があって確かめきれなければ）`None`。
///
/// # 例
///
/// ```text
/// check("1500 [kg]")                 → None
/// check("xs->collect{ in i; i*2 }")  → None
/// check("1 +")                       → Some({ at: 1, after: true,  message: "「+」の後に値がありません" })
/// check("1 2")                       → Some({ at: 1, after: false, message: "「1」と「2」の間に演算子がありません" })
/// check("a = b")                     → None   // 知らない記号（=）。確かめるのをやめる
/// ```
pub(crate) fn check(toks: &[Tok<'_>]) -> Option<Fault> {
    let mut c = Checker { toks, i: 0 };
    match c.expression() {
        Err(Stop::Fault(f)) => Some(f),
        Err(Stop::Unknown) => None,
        Ok(()) => c.adjacent_operand(),
    }
}

/// トークンの並びと、今の位置。
struct Checker<'a, 't> {
    toks: &'a [Tok<'t>],
    i: usize,
}

/// 2 項の演算子（BinaryOperator・ConditionalBinaryOperator、8.2.5.8.1）か。
///
/// # 引数
///
/// - `t`：トークン
///
/// # 戻り値
///
/// 2 項の演算子なら true。`+`・`-` は、値の始まりでは単項の演算子でもある（呼び出し側が位置で見分ける）。
///
/// # 例
///
/// ```text
/// is_binary_operator("==")  → true
/// is_binary_operator("and") → true
/// is_binary_operator("->")  → false   // 関数の呼び出しの記号
/// is_binary_operator("not") → false   // 単項の演算子
/// ```
fn is_binary_operator(t: Tok<'_>) -> bool {
    match t.kind {
        LT | GT | STAR | STAR2 => true,
        OP => matches!(
            t.text,
            "==" | "!="
                | "==="
                | "!=="
                | "<="
                | ">="
                | ".."
                | "??"
                | "+"
                | "-"
                | "/"
                | "%"
                | "^"
                | "|"
                | "&"
        ),
        KEYWORD => matches!(t.text, "or" | "and" | "implies" | "xor"),
        _ => false,
    }
}

/// 型を確かめる・型に直す演算子（ClassificationTestOperator・CastOperator・MetaclassificationTestOperator・MetaCastOperator、8.2.5.8.1）か。
///
/// # 引数
///
/// - `t`：トークン
///
/// # 戻り値
///
/// `istype`・`hastype`・`@`・`as`・`@@`・`meta` なら true。
///
/// # 例
///
/// ```text
/// is_classification_operator("istype") → true
/// is_classification_operator("@")      → true
/// is_classification_operator("is")     → false
/// ```
fn is_classification_operator(t: Tok<'_>) -> bool {
    match t.kind {
        AT => true,
        OP => t.text == "@@",
        KEYWORD => matches!(t.text, "istype" | "hastype" | "as" | "meta"),
        _ => false,
    }
}

impl<'t> Checker<'_, 't> {
    /// 今のトークン。末尾なら `None`。
    ///
    /// # 戻り値
    ///
    /// 今の位置のトークン。
    ///
    /// # 例
    ///
    /// ```text
    /// // "a + b" の位置 1
    /// peek() → Some(+)
    /// ```
    fn peek(&self) -> Option<Tok<'t>> {
        self.toks.get(self.i).copied()
    }

    /// 今のトークンが、その種類か。
    ///
    /// # 引数
    ///
    /// - `kind`：トークンの種類
    ///
    /// # 戻り値
    ///
    /// 今のトークンがその種類なら true。末尾なら false。
    ///
    /// # 例
    ///
    /// ```text
    /// // "( a" の位置 0
    /// at(L_PAREN) → true
    /// ```
    fn at(&self, kind: SyntaxKind) -> bool {
        self.peek().is_some_and(|t| t.kind == kind)
    }

    /// 今のトークンが、そのキーワードか。
    ///
    /// # 引数
    ///
    /// - `word`：キーワード
    ///
    /// # 戻り値
    ///
    /// 今のトークンがそのキーワードなら true。
    ///
    /// # 例
    ///
    /// ```text
    /// // "if a" の位置 0
    /// at_keyword("if") → true
    /// ```
    fn at_keyword(&self, word: &str) -> bool {
        self.peek()
            .is_some_and(|t| t.kind == KEYWORD && t.text == word)
    }

    /// 今のトークンが、その記号（`OP` の 1 つ）か。
    ///
    /// # 引数
    ///
    /// - `text`：記号
    ///
    /// # 戻り値
    ///
    /// 今のトークンがその記号なら true。
    ///
    /// # 例
    ///
    /// ```text
    /// // "? b" の位置 0
    /// at_symbol("?") → true
    /// ```
    fn at_symbol(&self, text: &str) -> bool {
        self.peek().is_some_and(|t| t.kind == OP && t.text == text)
    }

    /// 今のトークンが名前（基本名・引用名）か。
    ///
    /// # 戻り値
    ///
    /// 名前なら true。
    ///
    /// # 例
    ///
    /// ```text
    /// // "'a b' + 1" の位置 0
    /// at_name() → true
    /// ```
    fn at_name(&self) -> bool {
        self.at(IDENT) || self.at(QUOTED_NAME)
    }

    /// 次のトークンが、値の始まりとして何に当たるかを見る。
    ///
    /// # 戻り値
    ///
    /// 値が始まるなら `Operand`、値が無いと言えるなら `Missing`、知らない語や記号なら `Unknown`。
    ///
    /// # 例
    ///
    /// ```text
    /// // "1"・"-x"・"(a)"・"not b"   → Operand
    /// // 末尾・")"・","・"=="        → Missing
    /// // "="・知らないキーワード      → Unknown
    /// ```
    fn next(&self) -> Next {
        let Some(t) = self.peek() else {
            return Next::Missing;
        };
        match t.kind {
            IDENT | QUOTED_NAME | NUMBER | STRING | L_PAREN | L_BRACE | STAR | TILDE | AT => {
                Next::Operand
            }
            OP if matches!(t.text, "+" | "-") => Next::Operand,
            KEYWORD
                if matches!(
                    t.text,
                    "true" | "false" | "null" | "not" | "new" | "all" | "istype" | "hastype" | "if"
                ) =>
            {
                Next::Operand
            }
            R_PAREN | R_BRACK | R_BRACE | COMMA | SEMI => Next::Missing,
            OP if t.text == "?" => Next::Missing,
            KEYWORD if t.text == "else" => Next::Missing,
            _ if is_binary_operator(t) => Next::Missing,
            _ => Next::Unknown,
        }
    }

    /// 「〜の後に値がありません」の知らせを作る（値が無いと言えないときは、確かめるのをやめる）。
    ///
    /// # 引数
    ///
    /// - `before`：値の前にあるはずのトークンの番号（演算子・カンマ・開き括弧など）
    ///
    /// # 戻り値
    ///
    /// 次が `Missing` なら `Stop::Fault`、`Unknown` なら `Stop::Unknown`。
    ///
    /// # 例
    ///
    /// ```text
    /// // "1 +" で before = 1
    /// missing_after(1) → Fault({ at: 1, after: true, message: "「+」の後に値がありません" })
    /// ```
    fn missing_after(&self, before: usize) -> Stop {
        if self.next() == Next::Unknown {
            return Stop::Unknown;
        }
        let text = self.toks.get(before).map_or("", |t| t.text);
        Stop::Fault(Fault {
            at: before,
            after: true,
            message: Message::new("syntax.value-missing-after").arg("text", text),
        })
    }

    /// 値が続けて書かれている（間に演算子が無い）なら、その知らせを作る。
    ///
    /// # 戻り値
    ///
    /// 今のトークンが、名前・数・文字列（前の値に続けて書かれた値）なら、その知らせ。そうでなければ `None`。
    ///
    /// # 例
    ///
    /// ```text
    /// // "1 2" の位置 1
    /// adjacent_operand() → Some({ at: 1, after: false, message: "「1」と「2」の間に演算子がありません" })
    /// // "1 )" の位置 1・末尾
    /// adjacent_operand() → None
    /// ```
    fn adjacent_operand(&self) -> Option<Fault> {
        let t = self.peek()?;
        let before = self.toks.get(self.i.checked_sub(1)?)?;
        matches!(t.kind, IDENT | QUOTED_NAME | NUMBER | STRING).then(|| Fault {
            at: self.i,
            after: false,
            message: Message::new("syntax.operator-missing-between")
                .arg("before", before.text)
                .arg("after", t.text),
        })
    }

    /// 式（OwnedExpression、8.2.5.8.1）。`if 条件 ? 値 else 値` か、値を 2 項の演算子・型の演算子でつないだもの。
    ///
    /// # 戻り値
    ///
    /// 文法どおりにたどれたら `Ok`（式の終わりで止まる）。
    ///
    /// # 例
    ///
    /// ```text
    /// expression("a + b * c")          → Ok
    /// expression("if a ? 1 else 2")    → Ok
    /// expression("x istype T and y")   → Ok
    /// expression("a + ")               → Err(Fault「+」の後に値がありません)
    /// ```
    fn expression(&mut self) -> Step {
        if self.at_keyword("if") {
            return self.conditional();
        }
        self.operand()?;
        while let Some(t) = self.peek() {
            let op = self.i;
            if is_classification_operator(t) {
                self.i += 1;
                self.type_name(op)?;
            } else if is_binary_operator(t) {
                self.i += 1;
                if self.next() != Next::Operand {
                    return Err(self.missing_after(op));
                }
                // `a ?? if c ? x else y` のように、右側に if の式を書ける
                if self.at_keyword("if") {
                    return self.conditional();
                }
                self.operand()?;
            } else {
                break;
            }
        }
        Ok(())
    }

    /// `if 条件 ? 値 else 値`（ConditionalExpression、8.2.5.8.1）。
    ///
    /// # 戻り値
    ///
    /// 文法どおりにたどれたら `Ok`。`?`・`else` や、その後の値が無ければ `Fault`。
    ///
    /// # 例
    ///
    /// ```text
    /// conditional("if a > 1 ? 2 else 3") → Ok
    /// conditional("if a 2 else 3")       → Err(Fault「if」の式に「?」がありません)
    /// conditional("if a ? 2")            → Err(Fault「if」の式に「else」がありません)
    /// conditional("if a ? 2 else")       → Err(Fault「else」の後に値がありません)
    /// ```
    fn conditional(&mut self) -> Step {
        let if_at = self.i;
        self.i += 1;
        if self.next() != Next::Operand {
            return Err(self.missing_after(if_at));
        }
        self.expression()?;
        if !self.at_symbol("?") {
            return Err(self.part_missing("?"));
        }
        let question = self.i;
        self.i += 1;
        if self.next() != Next::Operand {
            return Err(self.missing_after(question));
        }
        self.expression()?;
        if !self.at_keyword("else") {
            return Err(self.part_missing("else"));
        }
        let else_at = self.i;
        self.i += 1;
        if self.next() != Next::Operand {
            return Err(self.missing_after(else_at));
        }
        self.expression()
    }

    /// `if` の式に要る部分（`?`・`else`）が無いときの知らせを作る。
    ///
    /// # 引数
    ///
    /// - `part`：無い部分（`?`・`else`）
    ///
    /// # 戻り値
    ///
    /// 式の終わり・閉じ括弧・値などに着いていれば `Fault`（前のトークンの後ろを指す）。知らない語や記号なら `Unknown`。
    ///
    /// # 例
    ///
    /// ```text
    /// // "if a ? 2" の末尾
    /// part_missing("else") → Fault({ at: 3, after: true, message: "「if」の式に「else」がありません" })
    /// ```
    fn part_missing(&self, part: &str) -> Stop {
        if self.next() == Next::Unknown {
            return Stop::Unknown;
        }
        Stop::Fault(Fault {
            at: self.i.saturating_sub(1),
            after: true,
            message: Message::new("syntax.if-part-missing").arg("part", part),
        })
    }

    /// 値 1 つ：単項の演算子（`+`・`-`・`~`・`not`）、基の値、その後ろに続くもの（`[単位]`・`.名前`・`->関数(…)` など）。
    ///
    /// # 戻り値
    ///
    /// 文法どおりにたどれたら `Ok`。
    ///
    /// # 例
    ///
    /// ```text
    /// operand("-x")              → Ok
    /// operand("1500 [kg]")       → Ok
    /// operand("a.b->sum()")      → Ok
    /// operand("not")             → Err(Fault「not」の後に値がありません)
    /// ```
    fn operand(&mut self) -> Step {
        while let Some(t) = self.peek() {
            let unary = matches!(t.kind, TILDE)
                || (t.kind == OP && matches!(t.text, "+" | "-"))
                || (t.kind == KEYWORD && t.text == "not");
            if !unary {
                break;
            }
            let op = self.i;
            self.i += 1;
            if self.next() != Next::Operand {
                return Err(self.missing_after(op));
            }
        }
        self.primary()?;
        self.postfixes()
    }

    /// 基の値（BaseExpression・SequenceExpression・ExtentExpression、8.2.5.8.2〜8.2.5.8.4）。
    ///
    /// # 戻り値
    ///
    /// 文法どおりにたどれたら `Ok`。値の始まりでないトークンにいたら `Unknown`（呼び出し側が先に `next` で確かめる）。
    ///
    /// # 例
    ///
    /// ```text
    /// primary("42")            → Ok
    /// primary("(a, b)")        → Ok
    /// primary("f(x, y = 1)")   → Ok
    /// primary("new P(1)")      → Ok
    /// primary("{ in i; i*2 }") → Ok   // 本体の中は確かめない
    /// ```
    fn primary(&mut self) -> Step {
        let Some(t) = self.peek() else {
            return Err(Stop::Unknown);
        };
        let at = self.i;
        match t.kind {
            NUMBER | STRING | STAR => {
                self.i += 1;
                Ok(())
            }
            KEYWORD if matches!(t.text, "true" | "false" | "null") => {
                self.i += 1;
                Ok(())
            }
            L_PAREN => {
                self.i += 1;
                if self.at(R_PAREN) {
                    self.i += 1;
                    return Ok(());
                }
                self.list(at, R_PAREN, true)
            }
            L_BRACE => self.body(),
            KEYWORD if t.text == "new" => {
                self.i += 1;
                self.type_name(at)?;
                if self.at(L_PAREN) {
                    self.arguments()
                } else {
                    Ok(())
                }
            }
            // `all T`（ExtentExpression）と、左の値の無い `istype T`・`hastype T`・`@T`（ClassificationExpression）
            KEYWORD if matches!(t.text, "all" | "istype" | "hastype") => {
                self.i += 1;
                self.type_name(at)
            }
            AT => {
                self.i += 1;
                self.type_name(at)
            }
            IDENT | QUOTED_NAME => {
                self.qualified_name();
                if self.at(L_PAREN) {
                    self.arguments()
                } else {
                    Ok(())
                }
            }
            _ => Err(Stop::Unknown),
        }
    }

    /// 値の後ろに続くもの（BracketExpression・IndexExpression・FeatureChainExpression・CollectExpression・SelectExpression・
    /// FunctionOperationExpression・MetadataAccessExpression、8.2.5.8.2〜8.2.5.8.3）を、続くかぎりたどる。
    ///
    /// # 戻り値
    ///
    /// 文法どおりにたどれたら `Ok`。
    ///
    /// # 例
    ///
    /// ```text
    /// // 値 x の後ろ
    /// postfixes(" [kg]")            → Ok
    /// postfixes("#(1)")             → Ok
    /// postfixes(".a.b")             → Ok
    /// postfixes(".?{ in p; p.ok }") → Ok
    /// postfixes("->collect{ … }")   → Ok
    /// postfixes(".")                → Err(Fault「.」の後に名前がありません)
    /// ```
    fn postfixes(&mut self) -> Step {
        while let Some(t) = self.peek() {
            let at = self.i;
            match t.kind {
                L_BRACK => {
                    self.i += 1;
                    self.list(at, R_BRACK, true)?;
                }
                HASH => {
                    self.i += 1;
                    if !self.at(L_PAREN) {
                        return Err(Stop::Unknown);
                    }
                    let open = self.i;
                    self.i += 1;
                    self.list(open, R_PAREN, true)?;
                }
                DOT => {
                    self.i += 1;
                    self.after_dot(at)?;
                }
                OP if t.text == "->" => {
                    self.i += 1;
                    self.name_after(at, "syntax.function-name-missing-after")?;
                    self.qualified_name();
                    if self.at(L_BRACE) {
                        self.body()?;
                    } else if self.at(L_PAREN) {
                        self.arguments()?;
                    } else if self.at_name() {
                        self.qualified_name();
                    }
                }
                _ => break,
            }
        }
        Ok(())
    }

    /// `.` の後ろ：名前（特徴の連鎖）、`metadata`、本体（collect）、`?` と本体（select）。
    ///
    /// # 引数
    ///
    /// - `dot`：`.` のトークンの番号
    ///
    /// # 戻り値
    ///
    /// 文法どおりにたどれたら `Ok`。
    ///
    /// # 例
    ///
    /// ```text
    /// after_dot("mass")           → Ok
    /// after_dot("metadata")       → Ok
    /// after_dot("{ in p; p.m }")  → Ok
    /// after_dot("?{ in p; p.ok }") → Ok
    /// after_dot("+ 1")            → Err(Fault「.」の後に名前がありません)
    /// ```
    fn after_dot(&mut self, dot: usize) -> Step {
        if self.at_symbol("?") {
            self.i += 1;
            return if self.at(L_BRACE) {
                self.body()
            } else {
                Err(Stop::Unknown)
            };
        }
        if self.at(L_BRACE) {
            return self.body();
        }
        if self.at_keyword("metadata") {
            self.i += 1;
            return Ok(());
        }
        self.name_after(dot, "syntax.name-missing-after")?;
        self.qualified_name();
        Ok(())
    }

    /// 今のトークンが名前であることを確かめる（名前は進めない）。
    ///
    /// # 引数
    ///
    /// - `before`：名前の前のトークンの番号（`.`・`->`・`istype` など）
    /// - `code`：無いときに知らせる文のコード（`syntax.name-missing-after`・`syntax.function-name-missing-after`・`syntax.type-name-missing-after`）
    ///
    /// # 戻り値
    ///
    /// 名前にいれば `Ok`。知らない語や記号にいれば `Unknown`、そのほか（式の終わり・閉じ括弧・演算子・数など）なら `Fault`。
    ///
    /// # 例
    ///
    /// ```text
    /// // "a. + 1" の位置 2、before = 1
    /// name_after(1, "syntax.name-missing-after")
    ///   → Err(Fault({ at: 1, after: true, message: syntax.name-missing-after{text=.} }))   // 「.」の後に名前がありません
    /// ```
    fn name_after(&self, before: usize, code: &'static str) -> Step {
        if self.at_name() {
            return Ok(());
        }
        if self.next() == Next::Unknown {
            return Err(Stop::Unknown);
        }
        let text = self.toks.get(before).map_or("", |t| t.text);
        Err(Stop::Fault(Fault {
            at: before,
            after: true,
            message: Message::new(code).arg("text", text),
        }))
    }

    /// 型の名前（TypeReference・InstantiatedTypeReference、8.2.5.8.1・8.2.5.8.3）。
    ///
    /// # 引数
    ///
    /// - `before`：型の名前の前のトークンの番号（`istype`・`as`・`new` など）
    ///
    /// # 戻り値
    ///
    /// 修飾名をたどれたら `Ok`。
    ///
    /// # 例
    ///
    /// ```text
    /// type_name("Q::T")  → Ok
    /// type_name(")")     → Err(Fault「as」の後に型の名前がありません)
    /// ```
    fn type_name(&mut self, before: usize) -> Step {
        self.name_after(before, "syntax.type-name-missing-after")?;
        self.qualified_name();
        Ok(())
    }

    /// 修飾名（`A::B::c`）を進める。名前にいなければ、何もしない。
    ///
    /// # 例
    ///
    /// ```text
    /// // "A::B + 1" の位置 0 → 位置 3（+）
    /// ```
    fn qualified_name(&mut self) {
        if !self.at_name() {
            return;
        }
        self.i += 1;
        while self.at(COLON2)
            && self
                .toks
                .get(self.i + 1)
                .is_some_and(|t| matches!(t.kind, IDENT | QUOTED_NAME))
        {
            self.i += 2;
        }
    }

    /// 本体（`{ … }`、BodyExpression、8.2.5.8.3）を、対応する `}` まで読み飛ばす。中は宣言と式の並びで、ここでは確かめない。
    ///
    /// # 戻り値
    ///
    /// 対応する `}` まで進めたら `Ok`。閉じていなければ `Unknown`（括弧の釣り合いは、構文解析が知らせる）。
    ///
    /// # 例
    ///
    /// ```text
    /// body("{ in i; { i } } + 1") → Ok（+ の手前で止まる）
    /// body("{ in i;")             → Err(Unknown)
    /// ```
    fn body(&mut self) -> Step {
        let mut depth = 0usize;
        while let Some(t) = self.peek() {
            self.i += 1;
            match t.kind {
                L_BRACE => depth += 1,
                R_BRACE => {
                    depth -= 1;
                    if depth == 0 {
                        return Ok(());
                    }
                }
                _ => {}
            }
        }
        Err(Stop::Unknown)
    }

    /// 括弧の中の、カンマで区切った式（SequenceExpressionList、8.2.5.8.2）。開き括弧の直後から、閉じ括弧まで。
    ///
    /// # 引数
    ///
    /// - `open`：開き括弧のトークンの番号
    /// - `close`：閉じ括弧の種類（`R_PAREN`・`R_BRACK`）
    /// - `trailing_comma`：最後のカンマを許すか（`(a, b,)` は許す。引数の並びは許さない）
    ///
    /// # 戻り値
    ///
    /// 閉じ括弧まで文法どおりにたどれたら `Ok`。
    ///
    /// # 例
    ///
    /// ```text
    /// list("a, b)")   → Ok
    /// list("a, )")    → Ok（trailing_comma が真のとき）
    /// list(", a)")    → Err(Fault「(」の後に値がありません)
    /// list("a b)")    → Err(Fault「a」と「b」の間に演算子がありません)
    /// ```
    fn list(&mut self, open: usize, close: SyntaxKind, trailing_comma: bool) -> Step {
        let mut before = open;
        loop {
            if self.next() != Next::Operand {
                return Err(self.missing_after(before));
            }
            self.expression()?;
            if !self.at(COMMA) {
                break;
            }
            before = self.i;
            self.i += 1;
            if trailing_comma && self.at(close) {
                break;
            }
        }
        self.close(close)
    }

    /// 閉じ括弧を読む。
    ///
    /// # 引数
    ///
    /// - `close`：閉じ括弧の種類
    ///
    /// # 戻り値
    ///
    /// 閉じ括弧にいれば進めて `Ok`。値が続けて書かれていれば `Fault`、そのほかは `Unknown`。
    ///
    /// # 例
    ///
    /// ```text
    /// // "(a b)" の b
    /// close(R_PAREN) → Err(Fault「a」と「b」の間に演算子がありません)
    /// ```
    fn close(&mut self, close: SyntaxKind) -> Step {
        if self.at(close) {
            self.i += 1;
            return Ok(());
        }
        Err(self.adjacent_operand().map_or(Stop::Unknown, Stop::Fault))
    }

    /// 引数の並び（ArgumentList、8.2.5.8.3）。位置で渡す `(a, b)` か、名前で渡す `(x = a, y = b)`。
    ///
    /// # 戻り値
    ///
    /// 閉じ括弧まで文法どおりにたどれたら `Ok`。
    ///
    /// # 例
    ///
    /// ```text
    /// arguments("()")             → Ok
    /// arguments("(a, b + 1)")     → Ok
    /// arguments("(x = 1, y = 2)") → Ok
    /// arguments("(,)")            → Err(Fault「(」の後に値がありません)
    /// arguments("(a,)")           → Err(Fault「,」の後に値がありません)
    /// ```
    fn arguments(&mut self) -> Step {
        let open = self.i;
        self.i += 1;
        if self.at(R_PAREN) {
            self.i += 1;
            return Ok(());
        }
        let mut before = open;
        loop {
            // 名前で渡す引数（`名前 = 式`）
            if self.at_name() && self.toks.get(self.i + 1).is_some_and(|t| t.kind == EQ) {
                before = self.i + 1;
                self.i += 2;
            }
            if self.next() != Next::Operand {
                return Err(self.missing_after(before));
            }
            self.expression()?;
            if !self.at(COMMA) {
                break;
            }
            before = self.i;
            self.i += 1;
        }
        self.close(R_PAREN)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::lexer::tokenize;

    /// 式のテキストを確かめ、壊れているところの（トークンの番号・後ろを指すか・文のコードと値）を返す。
    fn fault(text: &str) -> Option<(usize, bool, Message)> {
        let mut offset = 0;
        let mut toks: Vec<Tok<'_>> = Vec::new();
        for t in tokenize(text).0 {
            if !matches!(t.kind, WHITESPACE | LINE_NOTE | BLOCK_NOTE) {
                toks.push(Tok {
                    kind: t.kind,
                    text: &text[offset..offset + t.len],
                });
            }
            offset += t.len;
        }
        check(&toks).map(|f| (f.at, f.after, f.message))
    }

    /// 壊れていない（か、確かめきれない）式であることを確かめる。
    fn accepted(cases: &[&str]) -> Vec<String> {
        cases
            .iter()
            .filter_map(|c| fault(c).map(|f| format!("{c} → {}", f.2)))
            .collect()
    }

    #[test]
    fn literals_names_and_operators_are_accepted() {
        // Arrange（同値分割: 数・文字列・真偽・null・無限・名前・修飾名・引用名、単項と 2 項の演算子。8.2.5.8.1・8.2.5.8.4）
        let cases = [
            "42",
            "1.5",
            "2e-3",
            "\"text\"",
            "true",
            "false",
            "null",
            "*",
            "x",
            "A::B::c",
            "'a b'",
            "-x",
            "+x",
            "~x",
            "not x",
            "- -x",
            "a + b * c",
            "a ** b ^ c",
            "a % b / c",
            "a .. b",
            "1..*",
            "a == b",
            "a != b",
            "a === b",
            "a !== b",
            "a < b",
            "a <= b",
            "a > b",
            "a >= b",
            "a and b or c",
            "a xor b",
            "a implies b",
            "a ?? b",
            "a | b & c",
            "not a and not b",
        ];
        // Act
        let rejected = accepted(&cases);
        // Assert
        assert_eq!(rejected, Vec::<String>::new());
    }

    #[test]
    fn primary_expressions_are_accepted() {
        // Arrange（同値分割: 括弧・並び・単位・添字・連鎖・collect・select・関数・呼び出し・生成・メタデータ・本体。8.2.5.8.2〜8.2.5.8.3）
        let cases = [
            "(a + b) * c",
            "()",
            "(a, b, c)",
            "(a, b,)",
            "1500 [kg]",
            "10 [m/s] * 2",
            "9.8 [m/s**2]",
            "xs#(1)",
            "a.b.c",
            "a.b::c",
            "xs.{ in i; i * 2 }",
            "xs.?{ in p; p.ok }",
            "parts->collect{ p | p.mass }->sum()",
            "xs->size()",
            "xs->forAll f",
            "xs->select{ in x; x > 0 }",
            "f()",
            "f(a)",
            "f(a, b + 1)",
            "f(x = 1, y = 2)",
            "Q::f(a).b",
            "new P(1, 2)",
            "new P()",
            "x.metadata",
            "{ in i; i }",
            "(a)[1]",
            "a.b[kg]",
        ];
        // Act
        let rejected = accepted(&cases);
        // Assert
        assert_eq!(rejected, Vec::<String>::new());
    }

    #[test]
    fn conditional_and_classification_expressions_are_accepted() {
        // Arrange（if の式・型を確かめる式・型に直す式・範囲の式。8.2.5.8.1）
        let cases = [
            "if a > 1 ? 2.0 else 3.0",
            "if a ? b else if c ? d else e",
            "if a ? (if b ? 1 else 2) else 3",
            "a ?? if b ? 1 else 2",
            "x istype T",
            "x hastype Q::T",
            "x @ T",
            "x as T",
            "x @@ M",
            "x meta M",
            "istype T",
            "hastype T",
            "@Safety",
            "@Safety and not @Draft",
            "all T",
            "x as T + 1",
        ];
        // Act
        let rejected = accepted(&cases);
        // Assert
        assert_eq!(rejected, Vec::<String>::new());
    }

    #[test]
    fn an_operator_without_a_value_after_it_is_reported_at_the_operator() {
        // Act（異常系: 2 項の演算子・単項の演算子の後に値が無い。境界値: 式の末尾・閉じ括弧の手前・別の演算子の手前）
        let got = [
            fault("1 +"),
            fault("(a *)"),
            fault("a +* b"),
            fault("not"),
            fault("a and"),
            fault("x[kg /]"),
        ];
        // Assert
        assert_eq!(
            got,
            [
                Some((
                    1,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "+")
                )),
                Some((
                    2,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "*")
                )),
                // `*` は、値の位置では「無限」の値（LiteralInfinity）。その後ろに演算子が無い
                Some((
                    3,
                    false,
                    Message::new("syntax.operator-missing-between")
                        .arg("before", "*")
                        .arg("after", "b")
                )),
                Some((
                    0,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "not")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "and")
                )),
                Some((
                    3,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "/")
                )),
            ]
        );
    }

    #[test]
    fn values_without_an_operator_between_them_are_reported_at_the_second_value() {
        // Act（異常系: 式の一番上・括弧の中・引数の中）
        let got = [
            fault("1 2 3"),
            fault("a b"),
            fault("(a b)"),
            fault("f(a \"s\")"),
            fault("x [kg m]"),
        ];
        // Assert
        assert_eq!(
            got,
            [
                Some((
                    1,
                    false,
                    Message::new("syntax.operator-missing-between")
                        .arg("before", "1")
                        .arg("after", "2")
                )),
                Some((
                    1,
                    false,
                    Message::new("syntax.operator-missing-between")
                        .arg("before", "a")
                        .arg("after", "b")
                )),
                Some((
                    2,
                    false,
                    Message::new("syntax.operator-missing-between")
                        .arg("before", "a")
                        .arg("after", "b")
                )),
                Some((
                    3,
                    false,
                    Message::new("syntax.operator-missing-between")
                        .arg("before", "a")
                        .arg("after", "\"s\"")
                )),
                Some((
                    3,
                    false,
                    Message::new("syntax.operator-missing-between")
                        .arg("before", "kg")
                        .arg("after", "m")
                )),
            ]
        );
    }

    #[test]
    fn a_comma_or_bracket_without_a_value_is_reported() {
        // Act（異常系: 引数の並びと括弧の中の、値の無い所。境界値: 引数の最後のカンマは許さず、並びの最後のカンマは許す）
        let got = [
            fault("f(,)"),
            fault("f(a,)"),
            fault("f(a,, b)"),
            fault("(, a)"),
            fault("x[]"),
            fault("f(x = )"),
        ];
        // Assert
        assert_eq!(
            got,
            [
                Some((
                    1,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "(")
                )),
                Some((
                    3,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", ",")
                )),
                Some((
                    3,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", ",")
                )),
                Some((
                    0,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "(")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "[")
                )),
                Some((
                    3,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "=")
                )),
            ]
        );
    }

    #[test]
    fn an_incomplete_conditional_expression_is_reported() {
        // Act（異常系: 条件・「?」・「else」・その後の値が無い）
        let got = [
            fault("if"),
            fault("if a 2 else 3"),
            fault("if a ? 2"),
            fault("if a ? 2 else"),
            fault("if a ? else 3"),
        ];
        // Assert
        assert_eq!(
            got,
            [
                Some((
                    0,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "if")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.if-part-missing").arg("part", "?")
                )),
                Some((
                    3,
                    true,
                    Message::new("syntax.if-part-missing").arg("part", "else")
                )),
                Some((
                    4,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "else")
                )),
                Some((
                    2,
                    true,
                    Message::new("syntax.value-missing-after").arg("text", "?")
                )),
            ]
        );
    }

    #[test]
    fn a_missing_name_after_a_dot_arrow_or_type_operator_is_reported() {
        // Act（異常系）
        let got = [
            fault("a."),
            fault("a. + 1"),
            fault("xs->"),
            fault("x as"),
            fault("x istype )"),
            fault("new"),
        ];
        // Assert
        assert_eq!(
            got,
            [
                Some((
                    1,
                    true,
                    Message::new("syntax.name-missing-after").arg("text", ".")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.name-missing-after").arg("text", ".")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.function-name-missing-after").arg("text", "->")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.type-name-missing-after").arg("text", "as")
                )),
                Some((
                    1,
                    true,
                    Message::new("syntax.type-name-missing-after").arg("text", "istype")
                )),
                Some((
                    0,
                    true,
                    Message::new("syntax.type-name-missing-after").arg("text", "new")
                )),
            ]
        );
    }

    #[test]
    fn unknown_words_and_symbols_stop_the_check_without_a_report() {
        // Arrange（境界: 知らない語や記号に出会ったら、壊れているとは言わない。閉じていない括弧は構文解析が知らせる）
        let cases = [
            "a = b",
            "a => b",
            "a references b",
            "x : T",
            "a ! b",
            "$::A",
            "send x to y",
            "1 then 2",
            "f(a",
            "{ in i;",
            "xs.?",
            "x#",
            "a; b",
        ];
        // Act
        let rejected = accepted(&cases);
        // Assert
        assert_eq!(rejected, Vec::<String>::new());
    }

    #[test]
    fn an_empty_expression_is_not_reported() {
        // Act（境界値: トークンが無い。値が無いことは、呼び出し側が「値の式がありません」と知らせる）
        let got = check(&[]);
        // Assert
        assert_eq!(got, None);
    }
}
