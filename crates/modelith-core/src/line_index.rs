//! バイトオフセットと行・列の相互変換。
//!
//! コアは内部ではバイトオフセットで位置を扱い、UI / LSP との境界で行・列へ変換する。
//! 列は LSP の既定に合わせて UTF-16 コード単位で数える。

/// 0 始まりの行・列（列は UTF-16 コード単位）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LineCol {
    pub line: u32,
    pub col: u32,
}

/// テキストの行頭オフセット表。
#[derive(Debug, Clone)]
pub struct LineIndex {
    text: String,
    line_starts: Vec<usize>,
}

impl LineIndex {
    pub fn new(text: &str) -> Self {
        let line_starts = std::iter::once(0)
            .chain(text.match_indices('\n').map(|(i, _)| i + 1))
            .collect();
        Self {
            text: text.to_owned(),
            line_starts,
        }
    }

    /// バイトオフセットを行・列に変換する。範囲外や文字境界でない場合は `None`。
    pub fn line_col(&self, offset: usize) -> Option<LineCol> {
        if offset > self.text.len() || !self.text.is_char_boundary(offset) {
            return None;
        }
        let line = self.line_starts.partition_point(|&s| s <= offset) - 1;
        let start = self.line_starts[line];
        let col: usize = self.text[start..offset].chars().map(char::len_utf16).sum();
        Some(LineCol {
            line: u32::try_from(line).ok()?,
            col: u32::try_from(col).ok()?,
        })
    }

    /// 行・列をバイトオフセットに変換する。範囲外の場合は `None`。
    pub fn offset(&self, pos: LineCol) -> Option<usize> {
        let start = *self.line_starts.get(pos.line as usize)?;
        let end = self
            .line_starts
            .get(pos.line as usize + 1)
            .map_or(self.text.len(), |&e| e - 1);
        let mut utf16 = 0u32;
        for (i, c) in self.text[start..end].char_indices() {
            if utf16 == pos.col {
                return Some(start + i);
            }
            utf16 += c.len_utf16() as u32;
        }
        (utf16 == pos.col).then_some(end)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEXT: &str = "part def A;\n// 日本語\npart b : A;";

    #[test]
    fn roundtrip_ascii_and_multibyte() {
        let idx = LineIndex::new(TEXT);
        for (offset, _) in TEXT.char_indices().chain([(TEXT.len(), ' ')]) {
            let lc = idx.line_col(offset).unwrap();
            assert_eq!(idx.offset(lc), Some(offset), "offset {offset} -> {lc:?}");
        }
    }

    #[test]
    fn columns_are_utf16() {
        let idx = LineIndex::new(TEXT);
        let after_kanji = TEXT.find("語").unwrap() + "語".len();
        assert_eq!(idx.line_col(after_kanji), Some(LineCol { line: 1, col: 6 }));
    }

    #[test]
    fn rejects_out_of_range() {
        let idx = LineIndex::new(TEXT);
        assert_eq!(idx.line_col(TEXT.len() + 1), None);
        assert_eq!(idx.line_col(TEXT.find("語").unwrap() + 1), None);
        assert_eq!(idx.offset(LineCol { line: 9, col: 0 }), None);
        assert_eq!(idx.offset(LineCol { line: 0, col: 99 }), None);
    }
}
