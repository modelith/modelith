// AAA チェッカーのテスト用。区切りがそろったテストと、括弧を含む紛らわしい本体。
#[test]
fn simple() {
    // Arrange
    let a = 1;
    // Act
    let b = a + 1;
    // Assert
    assert_eq!(b, 2);
}

#[test]
#[should_panic]
fn braces_in_strings_and_lifetimes() {
    // Arrange
    let s: &'static str = "}{";
    let c = '{';
    // Act & Assert
    assert_eq!(format!("{s}{c}"), "}{{");
}
