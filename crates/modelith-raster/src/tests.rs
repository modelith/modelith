use resvg::tiny_skia::Pixmap;

use super::*;

/// 幅 20・高さ 10 で、左半分を赤く塗った SVG。
const HALF_RED: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="10" height="10" fill="#ff0000"/></svg>"##;

/// PNG を読み、(x, y) の色（赤・緑・青・不透明度）を返す。
fn pixel(png: &[u8], x: u32, y: u32) -> (u8, u8, u8, u8) {
    let pixmap = Pixmap::decode_png(png).expect("PNG として読める");
    let p = pixmap.pixel(x, y).expect("画像の中の点");
    (p.red(), p.green(), p.blue(), p.alpha())
}

#[test]
fn 図形を_svg_の大きさのまま描く() {
    // Act
    let image = render(HALF_RED, &Fonts::new(), 1.0, Background::White).expect("画像になる");
    // Assert
    assert_eq!((image.width, image.height), (20, 10));
    assert_eq!(&image.png[..8], b"\x89PNG\r\n\x1a\n");
    assert_eq!(pixel(&image.png, 2, 5), (255, 0, 0, 255));
    assert_eq!(pixel(&image.png, 17, 5), (255, 255, 255, 255));
    assert!(image.missing.is_empty());
}

#[test]
fn 倍率を掛けた大きさで描く() {
    // Act
    let image = render(HALF_RED, &Fonts::new(), 3.0, Background::White).expect("画像になる");
    // Assert（境目も 3 倍の位置に移る）
    assert_eq!((image.width, image.height), (60, 30));
    assert_eq!(pixel(&image.png, 28, 15), (255, 0, 0, 255));
    assert_eq!(pixel(&image.png, 31, 15), (255, 255, 255, 255));
}

#[test]
fn 背景を透明にすると_図形の無い所を塗らない() {
    // Act
    let image = render(HALF_RED, &Fonts::new(), 1.0, Background::Transparent).expect("画像になる");
    // Assert
    assert_eq!(pixel(&image.png, 17, 5), (0, 0, 0, 0));
    assert_eq!(pixel(&image.png, 2, 5), (255, 0, 0, 255));
}

#[test]
fn svg_として読めない文は断る() {
    // Act
    let result = render("<p>図ではない</p>", &Fonts::new(), 1.0, Background::White);
    // Assert
    assert_eq!(result, Err(RasterError::Svg));
}

#[test]
fn 大きさが_0_になる倍率は断る() {
    // Act
    let result = render(HALF_RED, &Fonts::new(), 0.0, Background::White);
    // Assert
    assert_eq!(result, Err(RasterError::Size));
}

#[test]
fn フォントが無ければ_書いてある文字を描けなかった文字として返す() {
    // Arrange（同じ文字が 2 回あり、空白もある）
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20"><text x="0" y="15">b a</text><g><text x="40" y="15">a<tspan>部</tspan></text></g><title>x</title></svg>"#;
    // Act
    let image = render(svg, &Fonts::new(), 1.0, Background::White).expect("画像になる");
    // Assert（重なりと空白を除き、文字の順。<text> の外の文字は数えない）
    assert_eq!(image.missing, vec!['a', 'b', '部']);
}

#[test]
fn フォントとして読めない中身は足さない() {
    // Arrange
    let mut fonts = Fonts::new();
    // Act
    let added = (fonts.add_sans(vec![1, 2, 3]), fonts.add_mono(Vec::new()));
    // Assert
    assert_eq!(added, (false, false));
    assert!(fonts.families().is_empty());
}

#[test]
fn 理由のコードは_種類ごとに違う() {
    // Act
    let codes = [
        RasterError::Svg.code(),
        RasterError::Size.code(),
        RasterError::Encode.code(),
    ];
    // Assert
    assert_eq!(codes, ["svg", "size", "encode"]);
}
