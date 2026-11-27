//! 図の SVG を、ブラウザ無しで PNG の画像にする（ADR-0029）。
//!
//! 受け取るのは SVG とフォントだけで、図の配置や描画は知らない。その所のフォントは読まず、渡されたフォントだけで描く
//! （どこで動かしても同じ画像になる）。コア（`modelith-core`）にも、ブラウザに配る wasm にも入れない。

mod wasm;

use std::collections::BTreeSet;
use std::sync::Arc;

use resvg::tiny_skia::{Color, Pixmap, Transform};
use resvg::usvg::fontdb::{Database, Family, Query, Source};
use resvg::usvg::{Options, Tree};
use skrifa::{FontRef, MetadataProvider};

/// 画像にできなかった理由。文は持たず、呼ぶ側が自分の言葉にする。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RasterError {
    /// SVG として読めない。
    Svg,
    /// 画像の大きさが 0、または大きすぎる。
    Size,
    /// PNG に書けない。
    Encode,
}

impl RasterError {
    /// 理由のコード（呼ぶ側が文を選ぶための名前）。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// `svg`・`size`・`encode` のどれか
    ///
    /// # 例
    /// `RasterError::Svg.code()` → `"svg"`
    pub fn code(self) -> &'static str {
        match self {
            RasterError::Svg => "svg",
            RasterError::Size => "size",
            RasterError::Encode => "encode",
        }
    }
}

/// 画像の背景。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Background {
    /// 白で塗る。
    White,
    /// 塗らない（透明）。
    Transparent,
}

/// 描くのに使うフォントの集まり。
#[derive(Clone, Default)]
pub struct Fonts {
    db: Database,
}

impl Fonts {
    /// フォントの無い集まりを作る。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// 空の集まり
    ///
    /// # 例
    /// `Fonts::new().families()` → `[]`
    pub fn new() -> Self {
        Self::default()
    }

    /// フォントを足す。`font-family="sans-serif"` と、名前の合うフォントが無い文字に使う。
    ///
    /// # 引数
    /// - `data`: フォントのファイルの中身（TrueType・OpenType）
    ///
    /// # 戻り値
    /// 足せたら `true`。フォントとして読めなければ `false`（集まりは変わらない）
    ///
    /// # 例
    /// `fonts.add_sans(noto_sans_jp_regular)` → `true`、`fonts.add_sans(vec![1, 2, 3])` → `false`
    pub fn add_sans(&mut self, data: Vec<u8>) -> bool {
        match self.add(data) {
            Some(family) => {
                self.db.set_sans_serif_family(family);
                true
            }
            None => false,
        }
    }

    /// 等幅のフォントを足す。`font-family="monospace"` に使う。
    ///
    /// # 引数
    /// - `data`: フォントのファイルの中身（TrueType・OpenType）
    ///
    /// # 戻り値
    /// 足せたら `true`。フォントとして読めなければ `false`（集まりは変わらない）
    ///
    /// # 例
    /// `fonts.add_mono(ibm_plex_mono_regular)` → `true`
    pub fn add_mono(&mut self, data: Vec<u8>) -> bool {
        match self.add(data) {
            Some(family) => {
                self.db.set_monospace_family(family);
                true
            }
            None => false,
        }
    }

    /// 入っているフォントの名前（重なりを除き、名前の順）。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// フォントの名前の一覧
    ///
    /// # 例
    /// Noto Sans JP の Regular と Bold を足した後 → `["Noto Sans JP"]`
    pub fn families(&self) -> Vec<String> {
        let names: BTreeSet<String> = self
            .db
            .faces()
            .filter_map(|f| f.families.first().map(|(name, _)| name.clone()))
            .collect();
        names.into_iter().collect()
    }

    /// フォントを集まりに足し、その名前を返す。
    ///
    /// # 引数
    /// - `data`: フォントのファイルの中身
    ///
    /// # 戻り値
    /// 足したフォントの名前。フォントとして読めなければ `None`
    ///
    /// # 例
    /// `fonts.add(noto_sans_jp_regular)` → `Some("Noto Sans JP")`
    fn add(&mut self, data: Vec<u8>) -> Option<String> {
        let ids = self.db.load_font_source(Source::Binary(Arc::new(data)));
        let face = self.db.face(*ids.first()?)?;
        face.families.first().map(|(name, _)| name.clone())
    }

    /// 文字を、入っているどれかのフォントで描けるか。
    ///
    /// # 引数
    /// - `c`: 文字
    ///
    /// # 戻り値
    /// 描けるフォントがあれば `true`
    ///
    /// # 例
    /// Noto Sans JP を足した後、`fonts.covers('部')` → `true`、`fonts.covers('가')` → `false`
    fn covers(&self, c: char) -> bool {
        self.db.faces().any(|face| {
            self.db
                .with_face_data(face.id, |data, index| has_glyph(data, index, c))
                .unwrap_or(false)
        })
    }
}

/// フォントに、その文字の形があるか。
///
/// # 引数
/// - `data`: フォントのファイルの中身
/// - `index`: ファイルの中の何番目のフォントか
/// - `c`: 文字
///
/// # 戻り値
/// 形があれば `true`。フォントとして読めなければ `false`
///
/// # 例
/// `has_glyph(noto_sans_jp_regular, 0, 'A')` → `true`
fn has_glyph(data: &[u8], index: u32, c: char) -> bool {
    FontRef::from_index(data, index).is_ok_and(|font| font.charmap().map(c).is_some())
}

/// 画像にした結果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Image {
    /// PNG のファイルの中身。
    pub png: Vec<u8>,
    /// 幅（ピクセル）。
    pub width: u32,
    /// 高さ（ピクセル）。
    pub height: u32,
    /// どのフォントにも形が無く、描けなかった文字（重なりを除き、文字の順）。空白は含めない。
    pub missing: Vec<char>,
}

/// SVG を PNG の画像にする。
///
/// # 引数
/// - `svg`: SVG の文
/// - `fonts`: 描くのに使うフォント
/// - `scale`: 倍率（1 で SVG の大きさのまま）
/// - `background`: 背景
///
/// # 戻り値
/// 画像と、描けなかった文字。SVG として読めない・大きさが 0 や大きすぎる・PNG に書けないときは、その理由
///
/// # 例
/// `render(r#"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>"#, &Fonts::new(), 2.0, Background::White)`
/// → 幅 40・高さ 20 の白い画像。`render("<p>", …)` → `Err(RasterError::Svg)`
pub fn render(
    svg: &str,
    fonts: &Fonts,
    scale: f32,
    background: Background,
) -> Result<Image, RasterError> {
    let mut options = Options::default();
    // 名前の合うフォントが無い文字は、sans-serif のフォントで描く
    if let Some(id) = fonts.db.query(&Query {
        families: &[Family::SansSerif],
        ..Query::default()
    }) && let Some(name) = fonts.db.face(id).and_then(|f| f.families.first())
    {
        options.font_family = name.0.clone();
    }
    options.fontdb = Arc::new(fonts.db.clone());
    let tree = Tree::from_str(svg, &options).map_err(|_| RasterError::Svg)?;
    let size = tree
        .size()
        .to_int_size()
        .scale_by(scale)
        .ok_or(RasterError::Size)?;
    let mut pixmap = Pixmap::new(size.width(), size.height()).ok_or(RasterError::Size)?;
    if background == Background::White {
        pixmap.fill(Color::WHITE);
    }
    resvg::render(
        &tree,
        Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    let png = pixmap.encode_png().map_err(|_| RasterError::Encode)?;
    let missing = written_chars(svg)
        .into_iter()
        .filter(|c| !fonts.covers(*c))
        .collect();
    Ok(Image {
        png,
        width: size.width(),
        height: size.height(),
        missing,
    })
}

/// SVG の `<text>` に書いてある文字を集める（空白は除く）。描けなかった文字は画像から消えるので、もとの SVG から集める。
///
/// # 引数
/// - `svg`: SVG の文
///
/// # 戻り値
/// 書いてある文字（重なりを除き、文字の順）。SVG として読めなければ空
///
/// # 例
/// `<svg …><text>b a</text><g><text>a<tspan>部</tspan></text></g></svg>` → `{'a', 'b', '部'}`
fn written_chars(svg: &str) -> BTreeSet<char> {
    let Ok(doc) = roxmltree::Document::parse(svg) else {
        return BTreeSet::new();
    };
    doc.descendants()
        .filter(|node| node.is_text() && node.ancestors().any(|a| a.has_tag_name((SVG_NS, "text"))))
        .flat_map(|node| node.text().unwrap_or_default().chars())
        .filter(|c| !c.is_whitespace())
        .collect()
}

/// SVG の要素の名前空間。
const SVG_NS: &str = "http://www.w3.org/2000/svg";

#[cfg(test)]
mod tests;
