@test "ok" {
  # Arrange
  local a=1
  # Act
  run echo "$a"
  # Assert
  [ "$output" = 1 ]
}
