describe("x", () => {
  it("has all markers with braces in strings", () => {
    // Arrange
    const s = "}{";
    // Act
    const out = s + '{';
    // Assert
    expect(out).toBe("}{{");
  });

  it.each([1, 2])("each %s", (n: number) => {
    // Arrange
    const m = n;
    // Act & Assert
    expect(m).toBe(n);
  });
});
