//! プラグインのマニフェストの `engines.modelith`（プラグインが動く本体の版の範囲。ADR-0023 §5）を、この本体の版と比べる。
//!
//! 書き方は Cargo の版の指定と同じ。比べる記号（`=`・`>`・`>=`・`<`・`<=`・`~`・`^`。省くと `^`）と、
//! 1〜3 個の数で書いた版を組にし、カンマで区切って並べる（すべてを満たす版が範囲）。
//! 本体の版は、プレリリースの印（`-rc.2` など）を外して比べる（`0.1.0-rc.2` の本体は `0.1.0` として扱う）。

/// 版（メジャー・マイナー・パッチ）。
type Ver = (u64, u64, u64);

/// この本体の版（`Cargo.toml` の版。プレリリースの印を含む）。
pub(crate) const HOST_VERSION: &str = env!("CARGO_PKG_VERSION");

/// 本体の版の文字列から、比べるための版を作る（プレリリースとビルドの印を外す。読めない数は 0）。
///
/// # 引数
///
/// - `s`: 本体の版の文字列
///
/// # 戻り値
///
/// メジャー・マイナー・パッチの組
///
/// # 例
///
/// ```text
/// host_ver("0.1.0-rc.2") → (0, 1, 0)
/// host_ver("1.2.3")      → (1, 2, 3)
/// host_ver("1.2")        → (1, 2, 0)
/// ```
pub(crate) fn host_ver(s: &str) -> Ver {
    let core = s.split(['-', '+']).next().unwrap_or("");
    let mut n = core.split('.').map(|x| x.parse::<u64>().unwrap_or(0));
    (
        n.next().unwrap_or(0),
        n.next().unwrap_or(0),
        n.next().unwrap_or(0),
    )
}

/// 範囲の書き方が誤っているときに利用者に見せる文を作る。
///
/// # 引数
///
/// - `range`: マニフェストに書かれた範囲
///
/// # 戻り値
///
/// 利用者に見せる文
///
/// # 例
///
/// ```text
/// bad_range("latest") → "動く Modelith の版の範囲（engines.modelith「latest」）の書き方が正しくありません。…"
/// ```
fn bad_range(range: &str) -> String {
    format!(
        "動く Modelith の版の範囲（engines.modelith「{range}」）の書き方が正しくありません。「>=0.1.0, <0.3.0」のように、比べる記号と版をカンマで区切って書いてください"
    )
}

/// 比べる記号と版を 1 組だけ読み、その組が許す版の下限（含む）と上限（含まない。無ければ None）にする。
///
/// # 引数
///
/// - `part`: 1 組の指定（`">=0.1.0"`・`"^0.2"` など）
///
/// # 戻り値
///
/// 下限と上限。書き方が誤っていれば None
///
/// # 例
///
/// ```text
/// bounds(">=0.1.0") → Some(((0, 1, 0), None))
/// bounds("^0.2")    → Some(((0, 2, 0), Some((0, 3, 0))))
/// bounds("<1")      → Some(((0, 0, 0), Some((1, 0, 0))))
/// bounds("1.x")     → None
/// ```
fn bounds(part: &str) -> Option<(Ver, Option<Ver>)> {
    let part = part.trim();
    let (op, rest) = [">=", "<=", "=", ">", "<", "~", "^"]
        .iter()
        .find_map(|op| part.strip_prefix(op).map(|r| (*op, r)))
        .unwrap_or(("^", part));
    let nums: Vec<u64> = rest
        .trim()
        .split('.')
        .map(|x| {
            (!x.is_empty() && x.bytes().all(|b| b.is_ascii_digit()))
                .then(|| x.parse().ok())
                .flatten()
        })
        .collect::<Option<_>>()?;
    let (major, minor, patch) = match nums[..] {
        [a] => (a, None, None),
        [a, b] => (a, Some(b), None),
        [a, b, c] => (a, Some(b), Some(c)),
        _ => return None,
    };
    let low = (major, minor.unwrap_or(0), patch.unwrap_or(0));
    // 書いた桁の次の版（`1.2` なら 1.3.0、`1.2.3` なら 1.2.4、`1` なら 2.0.0）
    let next = match (minor, patch) {
        (Some(m), Some(p)) => (major, m, p + 1),
        (Some(m), None) => (major, m + 1, 0),
        _ => (major + 1, 0, 0),
    };
    let zero = (0, 0, 0);
    Some(match op {
        "=" => (low, Some(next)),
        ">" => (next, None),
        ">=" => (low, None),
        "<" => (zero, Some(low)),
        "<=" => (zero, Some(next)),
        "~" => match minor {
            Some(m) => (low, Some((major, m + 1, 0))),
            None => (low, Some((major + 1, 0, 0))),
        },
        // `^`：一番左の 0 でない桁を変えない（0.x の間はマイナーまで、0.0.x はパッチまで）
        _ => {
            let high = match (major, minor, patch) {
                (m, _, _) if m > 0 => (m + 1, 0, 0),
                (0, Some(n), _) if n > 0 => (0, n + 1, 0),
                (0, Some(0), Some(p)) => (0, 0, p + 1),
                _ => next,
            };
            (low, Some(high))
        }
    })
}

/// 範囲が、この版を含むか。
///
/// # 引数
///
/// - `range`: マニフェストに書かれた範囲（`">=0.1.0, <0.3.0"` など）
/// - `v`: 比べる版（本体の版。[`host_ver`] で作る）
///
/// # 戻り値
///
/// 含めば `Ok(true)`、含まなければ `Ok(false)`。書き方が誤っていれば、利用者に見せる文を `Err` で返す
///
/// # 例
///
/// ```text
/// range_allows(">=0.1.0, <0.3.0", (0, 2, 0)) → Ok(true)
/// range_allows("^0.2", (0, 1, 0))            → Ok(false)
/// range_allows("latest", (0, 1, 0))          → Err("動く Modelith の版の範囲（engines.modelith「latest」）の書き方が正しくありません。…")
/// ```
pub(crate) fn range_allows(range: &str, v: Ver) -> Result<bool, String> {
    if range.trim().is_empty() {
        return Err(bad_range(range));
    }
    let mut ok = true;
    for part in range.split(',') {
        let (low, high) = bounds(part).ok_or_else(|| bad_range(range))?;
        ok &= v >= low && high.is_none_or(|h| v < h);
    }
    Ok(ok)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_version_drops_the_prerelease_mark() {
        // Act / Assert（境界値：プレリリース・ビルドの印・桁の足りない版）
        assert_eq!(host_ver("0.1.0-rc.2"), (0, 1, 0));
        assert_eq!(host_ver("1.2.3+abc"), (1, 2, 3));
        assert_eq!(host_ver("1.2"), (1, 2, 0));
    }

    #[test]
    fn each_operator_allows_the_cargo_range() {
        // Arrange（記号ごとの同値クラスと、上限・下限の境界値。[範囲, 版, 含むか]）
        let cases = [
            (">=0.1.0", (0, 1, 0), true),
            (">=0.1.0", (0, 0, 9), false),
            (">0.1.0", (0, 1, 0), false),
            (">0.1.0", (0, 1, 1), true),
            (">0.1", (0, 1, 9), false),
            (">0.1", (0, 2, 0), true),
            ("<0.3.0", (0, 2, 9), true),
            ("<0.3.0", (0, 3, 0), false),
            ("<=0.2", (0, 2, 9), true),
            ("<=0.2", (0, 3, 0), false),
            ("=0.2.1", (0, 2, 1), true),
            ("=0.2.1", (0, 2, 2), false),
            ("=0.2", (0, 2, 7), true),
            ("~0.2.3", (0, 2, 9), true),
            ("~0.2.3", (0, 3, 0), false),
            ("~1", (1, 9, 0), true),
            ("^0.2", (0, 2, 5), true),
            ("^0.2", (0, 3, 0), false),
            ("^1.2", (1, 9, 0), true),
            ("^1.2", (2, 0, 0), false),
            ("^0.0.3", (0, 0, 3), true),
            ("^0.0.3", (0, 0, 4), false),
            ("0.1.0", (0, 1, 5), true),
            ("0.1.0", (0, 2, 0), false),
        ];
        for (range, v, want) in cases {
            // Act
            let got = range_allows(range, v);
            // Assert
            assert_eq!(got, Ok(want), "{range} {v:?}");
        }
    }

    #[test]
    fn comma_separated_parts_must_all_hold() {
        // Act / Assert（空白の入れ方によらない）
        assert_eq!(range_allows(">=0.1.0, <0.3.0", (0, 2, 0)), Ok(true));
        assert_eq!(range_allows(" >= 0.1.0 ,<0.3.0 ", (0, 3, 0)), Ok(false));
        assert_eq!(range_allows(">=0.1.0, <0.3.0", (0, 0, 9)), Ok(false));
    }

    #[test]
    fn badly_written_ranges_are_errors() {
        // Act / Assert（異常系：空・名前・4 つ目の数・数でない桁・空の組・カンマの無い並び）
        for range in [
            "",
            " ",
            "latest",
            "0.1.0.1",
            "1.x",
            ">=0.1.0,",
            ">=0.1.0 <0.3.0",
        ] {
            assert_eq!(
                range_allows(range, (0, 1, 0)),
                Err(bad_range(range)),
                "{range:?}"
            );
        }
    }
}
