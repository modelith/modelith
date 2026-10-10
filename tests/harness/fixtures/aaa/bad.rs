#[test]
fn missing_assert() {
    // Arrange
    let a = 1;
    // Act
    let _b = a + 1;
}

#[test]
fn no_markers() {
    assert!(true);
}
