it("expression body cannot hold markers", () => expect(1).toBe(1));

test("missing arrange", () => {
  // Act
  const x = 1;
  // Assert
  expect(x).toBe(1);
});
