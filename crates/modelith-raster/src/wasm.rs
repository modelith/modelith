//! JavaScript（CLI）から呼ぶ口。判断は持たず、型を受け渡すだけ。

use wasm_bindgen::prelude::*;

use crate::{Background, Fonts, Image};

/// 描くのに使うフォントの集まり（JavaScript から足す）。
#[wasm_bindgen(js_name = Fonts)]
#[derive(Default)]
pub struct JsFonts(Fonts);

#[wasm_bindgen(js_class = Fonts)]
impl JsFonts {
    /// フォントの無い集まりを作る。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// 空の集まり
    ///
    /// # 例
    /// `new Fonts()`
    #[wasm_bindgen(constructor)]
    pub fn new() -> JsFonts {
        JsFonts::default()
    }

    /// フォントを足す（[`Fonts::add_sans`]）。
    ///
    /// # 引数
    /// - `data`: フォントのファイルの中身
    ///
    /// # 戻り値
    /// 足せたら `true`
    ///
    /// # 例
    /// `fonts.addSans(readFileSync("NotoSansJP-Regular.otf"))` → `true`
    #[wasm_bindgen(js_name = addSans)]
    pub fn add_sans(&mut self, data: Vec<u8>) -> bool {
        self.0.add_sans(data)
    }

    /// 等幅のフォントを足す（[`Fonts::add_mono`]）。
    ///
    /// # 引数
    /// - `data`: フォントのファイルの中身
    ///
    /// # 戻り値
    /// 足せたら `true`
    ///
    /// # 例
    /// `fonts.addMono(readFileSync("IBMPlexMono-Regular.ttf"))` → `true`
    #[wasm_bindgen(js_name = addMono)]
    pub fn add_mono(&mut self, data: Vec<u8>) -> bool {
        self.0.add_mono(data)
    }
}

/// 画像にした結果（JavaScript に渡す）。
#[wasm_bindgen(js_name = Image)]
pub struct JsImage(Image);

#[wasm_bindgen(js_class = Image)]
impl JsImage {
    /// PNG のファイルの中身。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// PNG のバイト列
    ///
    /// # 例
    /// `image.png` → `Uint8Array [137, 80, 78, 71, …]`
    #[wasm_bindgen(getter)]
    pub fn png(&self) -> Vec<u8> {
        self.0.png.clone()
    }

    /// 幅（ピクセル）。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// 幅
    ///
    /// # 例
    /// `image.width` → `40`
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.0.width
    }

    /// 高さ（ピクセル）。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// 高さ
    ///
    /// # 例
    /// `image.height` → `20`
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.0.height
    }

    /// 描けなかった文字を、つなげた文字列。
    ///
    /// # 引数
    /// なし
    ///
    /// # 戻り値
    /// 描けなかった文字（無ければ空文字列）
    ///
    /// # 例
    /// `image.missing` → `"가나"`
    #[wasm_bindgen(getter)]
    pub fn missing(&self) -> String {
        self.0.missing.iter().collect()
    }
}

/// SVG を PNG の画像にする（[`crate::render`]）。
///
/// # 引数
/// - `svg`: SVG の文
/// - `fonts`: 描くのに使うフォント
/// - `scale`: 倍率
/// - `transparent`: 背景を透明にするか（しなければ白）
///
/// # 戻り値
/// 画像。できなかったときは、理由のコード（`svg`・`size`・`encode`）を例外として投げる
///
/// # 例
/// `renderPng(svg, fonts, 2, false).width` → SVG の幅の 2 倍
#[wasm_bindgen(js_name = renderPng)]
pub fn render_png(
    svg: &str,
    fonts: &JsFonts,
    scale: f32,
    transparent: bool,
) -> Result<JsImage, String> {
    let background = if transparent {
        Background::Transparent
    } else {
        Background::White
    };
    crate::render(svg, &fonts.0, scale, background)
        .map(JsImage)
        .map_err(|e| e.code().to_string())
}
