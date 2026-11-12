//! 型付けのほかの、名前で指す相手の見つからない箇所（定義の特殊化 `:>`・別名 `alias … for`・`import`）を問題にする（F-EDIT-5）。
//!
//! 型付けの検査（`Builder::usages`）と同じく、標準ライブラリの名前は問題にせず、フォルダを開いているときは
//! ほかのファイルの名前も解決する（F-FILE-15）。ライブラリは同梱していないので、ライブラリのパッケージで始まる名前と、
//! ライブラリのパッケージから `import` した名前は、中身を確かめずに見つかるものとする。

use super::{Builder, is_lib, is_library_package, is_standard_view};

impl Builder<'_> {
    /// 定義の特殊化・別名・`import` の相手が見つからない箇所を、問題一覧に加える（モデルの `problems` を書き換える）。
    pub(super) fn missing_references(&mut self) {
        self.missing_generals();
        self.missing_alias_targets();
        self.missing_imports();
    }

    /// 定義の特殊化（`part def P :> Nope;`）の相手の定義が見つからなければ、問題にする（モデルの `problems` を書き換える）。
    /// 特徴の連鎖（`:> a.b`）は定義の特殊化の相手ではないので確かめない。
    fn missing_generals(&mut self) {
        let entries = self.entries;
        for e in entries.iter().filter(|e| e.is_def) {
            for s in e.specs.iter().filter(|s| s.op == "specializes") {
                if s.path.is_empty() || s.target.contains('.') {
                    continue;
                }
                if self.def_of(&s.path, e.pe).is_some()
                    || self.lookup(&s.path, e.pe).is_some()
                    || self.is_library_name(&s.path)
                {
                    continue;
                }
                self.problem(
                    e.start,
                    format!("引き継ぐ定義「{}」が見つかりません（{}）", s.path, e.name),
                    None,
                );
            }
        }
    }

    /// 別名（`alias T for Nope;`）の指す先が見つからなければ、問題にする（モデルの `problems` を書き換える）。
    fn missing_alias_targets(&mut self) {
        let p = self.p;
        for a in &p.aliases {
            if self.lookup(&a.target, a.pe).is_some() || self.is_library_name(&a.target) {
                continue;
            }
            self.problem(
                a.start,
                format!(
                    "別名「{}」の指す先「{}」が見つかりません（alias）",
                    a.name, a.target
                ),
                None,
            );
        }
    }

    /// `import` の相手が見つからなければ、問題にする（モデルの `problems` を書き換える）。
    /// 誤って問題にしないよう、最初の段が標準ライブラリのパッケージでも、モデルのどこかの要素や別名の名前でもないときだけにする。
    fn missing_imports(&mut self) {
        let p = self.p;
        for i in &p.import_list {
            let first = i.path.split("::").next().unwrap_or("");
            if first.is_empty()
                || is_library_package(first)
                || self.lookup(&i.path, i.pe).is_some()
                || self.by_name.contains_key(first)
                || p.aliases.iter().any(|a| a.name == first)
            {
                continue;
            }
            self.problem(
                i.start,
                format!("インポートする相手「{}」が見つかりません（import）", i.path),
                None,
            );
        }
    }

    /// 名前が標準ライブラリのものとみなせるか。`is_lib` の名前と標準ビュー定義（`GeneralView` など）に加えて、ライブラリのパッケージで始まる修飾名と、
    /// ライブラリのパッケージから `import` した修飾の無い名前（`P::*` で取り込んだものか、`P::名前` で取り込んだもの）。
    ///
    /// # 引数
    ///
    /// - `path`：書いた名前（修飾名なら `::` でつなぎ、引用符を外したもの）
    ///
    /// # 戻り値
    ///
    /// 標準ライブラリのものとみなせれば true。
    ///
    /// # 例
    ///
    /// ```text
    /// is_library_name("Part")                           → true    // LIBRARY_TYPES
    /// is_library_name("GeneralView")                    → true    // 標準ビュー定義
    /// is_library_name("Metaobjects::SemanticMetadata")  → true    // ライブラリのパッケージで修飾
    /// // "import Metaobjects::*;" があるとき
    /// is_library_name("SemanticMetadata")               → true
    /// is_library_name("Nope")                           → false
    /// ```
    fn is_library_name(&self, path: &str) -> bool {
        if is_lib(path, self.quantities_imported) || is_standard_view(path) {
            return true;
        }
        let mut segs = path.split("::");
        let first = segs.next().unwrap_or("");
        if path.contains("::") {
            return is_library_package(first);
        }
        self.p.import_list.iter().any(|i| {
            let from = i.path.split("::").next().unwrap_or("");
            is_library_package(from) && (i.members || i.path.rsplit("::").next() == Some(path))
        })
    }
}
