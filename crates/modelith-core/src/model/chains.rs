//! 特徴の連鎖（`a.b.c.d`、FeatureChain、8.2.2.6・KerML 8.2.5）を、2 段目から先までたどる。
//!
//! 各段は、前の段の宣言の本体、その型の定義の本体、型の定義が特殊化した定義の本体、前の段が部分集合・再定義した相手の順に探す。
//! 探す先がファイルの外（標準ライブラリなど）にあり、中身を確かめられないときは、見つからないとは言わない。

use crate::project::text::ref_segs;
use std::collections::HashSet;

use super::Builder;

/// 連鎖の 2 段目から先をたどった結果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ChainEnd {
    /// 最後の段の宣言の番号。
    Found(usize),
    /// `rest` の何番目（0 から）の段が見つからないか。前の段の中身はすべてファイルの中にあり、その名前は無いと言い切れる。
    Missing(usize),
    /// 途中の段の中身を確かめられない（型の無い使用・ファイルの外の型を持つ使用の中を探した）。
    Unknown,
}

impl Builder<'_> {
    /// 宣言 `from` から、連鎖の残りの段 `rest` を順にたどる。
    ///
    /// # 引数
    ///
    /// - `from`：連鎖の最初の段の宣言の番号
    /// - `rest`：2 段目から先の名前（空なら `from` そのもの）
    ///
    /// # 戻り値
    ///
    /// 最後の段の宣言（`Found`）、見つからない段の位置（`Missing`）、確かめられない（`Unknown`）のどれか。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def C { part d { port p; } } part def B { part c : C; } part def A { part b : B; }" のとき
    /// follow_chain(b の番号, ["c", "d", "p"]) → Found(p の番号)       // 型 B・C の中をたどる
    /// follow_chain(b の番号, ["c", "x"])      → Missing(1)            // C の中に x が無い
    /// follow_chain(b の番号, [])              → Found(b の番号)
    /// // "part def A { part u; }" の u（型が無く、本体も無い）から
    /// follow_chain(u の番号, ["x"])           → Unknown
    /// ```
    pub(crate) fn follow_chain(&self, from: usize, rest: &[&str]) -> ChainEnd {
        let mut cur = from;
        for (i, seg) in rest.iter().enumerate() {
            match self.feature_named(cur, seg) {
                Ok(Some(c)) => cur = c,
                Ok(None) => return ChainEnd::Missing(i),
                Err(()) => return ChainEnd::Unknown,
            }
        }
        ChainEnd::Found(cur)
    }

    /// 連鎖 `chain` の、最初の段を `head` としたとき、2 段目から先で見つからない段（`skip` 段目より後ろのもの）を、
    /// 問題の文の頭（`「a.b.x」の「x」`）にする。最初の段は呼び出し側が確かめる。
    ///
    /// # 引数
    ///
    /// - `head`：最初の段の宣言の番号。None なら何もしない（最初の段が見つからない）
    /// - `chain`：書いた連鎖（`a.b.x` など）
    /// - `skip`：2 段目から数えて、ほかの検査が確かめる段の数（線の端の 2 段目のポートは 1）
    ///
    /// # 戻り値
    ///
    /// 見つからない段があれば `「連鎖」の「段の名前」`。すべて見つかるか、確かめられなければ None。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def C { part d; } part def A { part c : C; }" の A の中で
    /// chain_miss(Some(c の番号), "c.d", 0)   → None
    /// chain_miss(Some(c の番号), "c.x", 0)   → Some("「c.x」の「x」")
    /// chain_miss(Some(c の番号), "c.x", 1)   → None            // 2 段目はほかの検査が確かめる
    /// chain_miss(Some(c の番号), "c.d.y", 1) → None            // d は型も本体も無いので確かめられない
    /// chain_miss(None, "z.q", 0)             → None
    /// ```
    pub(crate) fn chain_miss(
        &self,
        head: Option<usize>,
        chain: &str,
        skip: usize,
    ) -> Option<String> {
        let rest: Vec<&str> = ref_segs(chain).into_iter().skip(1).collect();
        match self.follow_chain(head?, &rest) {
            ChainEnd::Missing(i) if i >= skip => Some(format!("「{chain}」の「{}」", rest[i])),
            _ => None,
        }
    }

    /// 宣言 `i` の特性のうち、名前 `nm` のもの。本体・型の定義（とその一般の定義）・部分集合や再定義の相手の順に探す。
    ///
    /// # 引数
    ///
    /// - `i`：中身を探す宣言の番号
    /// - `nm`：探す名前
    ///
    /// # 戻り値
    ///
    /// 見つかれば `Ok(Some(番号))`、探す先がすべてファイルの中にあって無ければ `Ok(None)`。
    /// 探す先にファイルの外のもの（型の無い使用・見つからない型や相手）があり、見つからなければ `Err(())`（確かめられない）。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def G { port g; } part def T :> G; part def A { part t : T; part u; part w : Lib; }" のとき
    /// feature_named(t の番号, "g") → Ok(Some(g の番号))   // 一般の定義 G から引き継ぐ
    /// feature_named(t の番号, "x") → Ok(None)
    /// feature_named(u の番号, "x") → Err(())             // 型も本体も無い
    /// feature_named(w の番号, "x") → Err(())             // 型がファイルの外
    /// ```
    fn feature_named(&self, i: usize, nm: &str) -> Result<Option<usize>, ()> {
        let mut seen = HashSet::new();
        let mut stack = vec![i];
        let mut known = true;
        while let Some(x) = stack.pop() {
            if !seen.insert(x) {
                continue;
            }
            if let Some(c) = self.child_named(x, nm) {
                return Ok(Some(c));
            }
            let e = self.e(x);
            if !e.is_def {
                match self.type_scope(x) {
                    Some(d) => stack.push(d),
                    // 型がファイルの外にある使用と、型も本体も無い使用（`event occurrence e;` など）の中身は確かめられない
                    None => {
                        if !e.ty.is_empty() || e.children.is_empty() {
                            known = false;
                        }
                    }
                }
            }
            for s in &e.specs {
                let target = if e.is_def {
                    (s.op == "specializes")
                        .then(|| self.def_of(&s.path, e.pe))
                        .flatten()
                } else {
                    self.resolve(&s.target, e.pe)
                };
                match target {
                    Some(t) => stack.push(t),
                    None => known = false,
                }
            }
        }
        if known { Ok(None) } else { Err(()) }
    }
}

/// 再定義の相手を探すために、引き継いだ特性を入れ子でたどる数の上限（輪になった再定義で止まらないように）。
const MAX_INHERIT_DEPTH: usize = 8;

/// 参照のそれぞれが、特性 `target` を指すか（再定義 `:>>` をたどって `target` に行き着くものも含む）。
/// 特性の名前を変えるとき、持ち主の外の参照（`W::n`・`f.n`・型や特殊化で引き継いだ先の `:>> n`）を探すのに使う（F-EDIT-3）。
///
/// # 引数
///
/// - `p`：解析結果
/// - `refs`：`(書いた参照, 参照を書いた場所を囲む一番内側の宣言の番号)` の並び。参照は `n`・`W::n`・`f.n` の形
/// - `target`：名前を変える特性の宣言の番号
///
/// # 戻り値
///
/// `refs` と同じ順の真偽値。指す先が見つからない参照は false。
///
/// # 例
///
/// ```text
/// // "part def W { attribute n; } part def W2 :> W { attribute :>> n; } part def B { part f : W; attribute t = f.n; }" のとき
/// refers_to_feature(p, [("W::n", B), ("f.n", t), ("n", W2 の n), ("n", t)], W の n)
///   → [true, true, true, false]   // 最後は B から見える n が無い
/// ```
pub(crate) fn refers_to_feature(
    p: &crate::project::ParseResult,
    refs: &[(String, Option<usize>)],
    target: usize,
) -> Vec<bool> {
    let b = Builder::new(p);
    refs.iter()
        .map(|(r, ctx)| {
            b.designated(r, *ctx)
                .into_iter()
                .any(|i| b.redefines_to(i, target))
        })
        .collect()
}

impl Builder<'_> {
    /// 参照が指す宣言の候補。連鎖（`f.n`）は 2 段目から先を型・特殊化の中までたどり、修飾名（`W::n`）は `lookup` で探す。
    /// 修飾の無い名前は、書いた場所から外へ、各段の直下の中身、無ければその段が型・特殊化から引き継いだ特性を探す。
    ///
    /// # 引数
    ///
    /// - `reference`：書いた参照
    /// - `ctx`：参照を書いた場所を囲む一番内側の宣言の番号
    ///
    /// # 戻り値
    ///
    /// 指す宣言の番号の並び（引き継いだ特性は、複数の一般の定義から来ることがあるので複数）。見つからなければ空。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def W { attribute n; } part def W2 :> W { attribute k = n; }" のとき
    /// designated("n", Some(k の番号))   → [W の n]   // W2 が引き継いだ n
    /// designated("W::n", Some(k の番号)) → [W の n]
    /// designated("x", Some(k の番号))   → []
    /// ```
    fn designated(&self, reference: &str, ctx: Option<usize>) -> Vec<usize> {
        let segs = ref_segs(reference);
        if let [first, rest @ ..] = segs.as_slice()
            && !rest.is_empty()
        {
            return match self.lookup(first, ctx).map(|h| self.follow_chain(h, rest)) {
                Some(ChainEnd::Found(i)) => vec![i],
                _ => Vec::new(),
            };
        }
        if reference.contains("::") {
            return self.lookup(reference, ctx).into_iter().collect();
        }
        let nm = crate::project::text::unquote(reference);
        let mut scope = ctx;
        while let Some(x) = scope {
            if let Some(c) = self.child_named(x, nm) {
                return vec![c];
            }
            let inherited = self.inherited_named(x, nm, 0);
            if !inherited.is_empty() {
                return inherited;
            }
            scope = self.e(x).pe;
        }
        Vec::new()
    }

    /// 宣言 `owner` が型・特殊化・部分集合・再定義の相手から引き継いだ特性のうち、名前 `nm` のもの（`owner` 自身の中身は含めない）。
    ///
    /// # 引数
    ///
    /// - `owner`：引き継ぐ側の宣言の番号
    /// - `nm`：探す名前
    /// - `depth`：再定義の相手を探すために入れ子でたどった数（最初は 0。上限を超えたら探さない）
    ///
    /// # 戻り値
    ///
    /// 一般の側の各段で見つかった特性の番号（近い段から）。無ければ空（たどった数が上限を超えたときも）。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def W { attribute n; } part def W2 :> W; part def B { part f : W2; }" のとき
    /// inherited_named(f の番号, "n", 0) → [W の n]
    /// inherited_named(W の番号, "n", 0) → []   // 自身の中身は含めない
    /// inherited_named(f の番号, "n", 9) → []   // 上限を超えた
    /// ```
    fn inherited_named(&self, owner: usize, nm: &str, depth: usize) -> Vec<usize> {
        // 自分の中の使用を一般の側にした使用（`part p :> p.q { part q :>> q; }`）は輪になるので、たどる数を限る
        if depth > MAX_INHERIT_DEPTH {
            return Vec::new();
        }
        let mut seen = HashSet::from([owner]);
        let mut stack = self.generals_of(owner, depth);
        let mut out = Vec::new();
        while let Some(x) = stack.pop() {
            if !seen.insert(x) {
                continue;
            }
            if let Some(c) = self.child_named(x, nm) {
                out.push(c);
            }
            stack.extend(self.generals_of(x, depth));
        }
        out
    }

    /// 宣言の一般の側（使用なら型の定義、定義なら特殊化の相手、使用の部分集合・再定義の相手）。
    ///
    /// # 引数
    ///
    /// - `x`：宣言の番号
    /// - `depth`：`inherited_named` を入れ子でたどった数
    ///
    /// # 戻り値
    ///
    /// 一般の側の宣言の番号の並び。見つからない相手は含めない。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def W; part def W2 :> W; part def B { part f : W2; }" のとき
    /// generals_of(W2 の番号, 0) → [W]
    /// generals_of(f の番号, 0)  → [W2]
    /// generals_of(W の番号, 0)  → []
    /// ```
    fn generals_of(&self, x: usize, depth: usize) -> Vec<usize> {
        let e = self.e(x);
        let mut out: Vec<usize> = Vec::new();
        if !e.is_def {
            out.extend(self.type_scope(x));
        }
        for s in &e.specs {
            out.extend(self.spec_targets(x, s, depth));
        }
        out
    }

    /// 宣言 `x` に書いた特殊化・部分集合・再定義の相手。修飾の無い名前の再定義（`:>> n`）は、持ち主が引き継いだ特性から探す
    /// （持ち主の中の `x` 自身を指さないように）。
    ///
    /// # 引数
    ///
    /// - `x`：相手を書いた宣言の番号
    /// - `s`：`x` の特殊化などの 1 つ
    /// - `depth`：`inherited_named` を入れ子でたどった数
    ///
    /// # 戻り値
    ///
    /// 相手の宣言の番号の並び。見つからなければ空。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def W { attribute n; } part def W2 :> W { attribute :>> n; }" のとき
    /// spec_targets(W2 の番号, ":> W", 0)            → [W]
    /// spec_targets(W2 の n の番号, ":>> n", 0)       → [W の n]
    /// ```
    fn spec_targets(&self, x: usize, s: &crate::project::Spec, depth: usize) -> Vec<usize> {
        let e = self.e(x);
        if e.is_def {
            return (s.op == "specializes")
                .then(|| self.def_of(&s.path, e.pe))
                .flatten()
                .into_iter()
                .collect();
        }
        let plain = !s.target.contains('.') && !s.target.contains("::");
        match e.pe {
            Some(pe) if s.op == "redefines" && plain => {
                self.inherited_named(pe, crate::project::text::unquote(&s.target), depth + 1)
            }
            _ => self.resolve(&s.target, e.pe).into_iter().collect(),
        }
    }

    /// 宣言 `i` が `target` そのものか、再定義（`:>>`）を何段かたどって `target` に行き着くか。
    ///
    /// # 引数
    ///
    /// - `i`：調べる宣言の番号
    /// - `target`：行き着くか確かめる宣言の番号
    ///
    /// # 戻り値
    ///
    /// 行き着けば true。
    ///
    /// # 例
    ///
    /// ```text
    /// // "part def W { attribute n; } part def W2 :> W { attribute :>> n; } part def Z { attribute n; }" のとき
    /// redefines_to(W2 の n, W の n) → true
    /// redefines_to(Z の n, W の n)  → false
    /// ```
    fn redefines_to(&self, i: usize, target: usize) -> bool {
        let mut seen = HashSet::new();
        let mut stack = vec![i];
        while let Some(x) = stack.pop() {
            if x == target {
                return true;
            }
            if !seen.insert(x) {
                continue;
            }
            for s in self.e(x).specs.iter().filter(|s| s.op == "redefines") {
                stack.extend(self.spec_targets(x, s, 0));
            }
        }
        false
    }
}
