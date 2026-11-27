//! 同じ場所（同じ持ち主の直下）に同じ名前の要素が 2 つあることを問題にする（F-EDIT-5）。
//!
//! 名前空間の直下の要素は、名前で区別できなければならない（KerML の validateNamespaceDistinguishability）。
//! 区別できないと、名前で指したときにどちらを指すのかが決まらない。

use std::collections::HashMap;

use super::Builder;
use crate::Message;
use crate::project::merge::file_of;

impl Builder<'_> {
    /// 同じ持ち主の直下で、先に宣言した要素と同じ名前の要素を、問題一覧に加える（モデルの `problems` を書き換える）。
    /// 名前の無い要素と、名前を書かずに関係の相手の名前を借りた要素（`:>> mass`・`perform x;`）は比べない。
    /// 3 つ以上あれば、2 つめ以降をそれぞれ知らせる。ファイルをまたいでは比べない（同じ名前の package を
    /// 複数のファイルに分けて書けるため。ADR-0021）。
    pub(super) fn duplicate_names(&mut self) {
        let entries = self.entries;
        let mut seen: HashMap<(usize, Option<usize>, &str), usize> = HashMap::new();
        let mut found = Vec::new();
        for (i, e) in entries.iter().enumerate() {
            if e.name.is_empty() || e.borrowed_name {
                continue;
            }
            if seen
                .insert((file_of(e.start), e.pe, e.name.as_str()), i)
                .is_some()
            {
                found.push(i);
            }
        }
        for i in found {
            let e = &entries[i];
            let place = e.pe.map(|p| entries[p].name.as_str()).unwrap_or("");
            let at = if place.is_empty() {
                "同じ場所".to_owned()
            } else {
                format!("「{place}」の中")
            };
            self.problem(
                e.start,
                Message::verbatim(format!(
                    "「{}」という名前は、{at}で既に使われています。どちらかの名前を変えてください",
                    e.name
                )),
                None,
            );
        }
    }
}
