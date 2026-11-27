//! プラグインとルールのファイルを読み込むときの問題の文（`locales/ja/rules.ftl`）が、
//! 辞書に移す前にコアが作っていた日本語の文と同じことを確かめる（ADR-0027 §3。言い回しを変えたら、ここが変わる）。

use modelith_core::message::Message;
use modelith_messages::render;

/// 辞書のテキスト。
const FTL: &str = include_str!("../locales/ja/rules.ftl");

/// 辞書のキー（行の頭から「 =」の前まで）を、書いた順に並べる。
fn keys() -> Vec<&'static str> {
    FTL.lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key))
        .collect()
}

/// 名前の並びをつなぐ文（`rules.list-join`）。
fn join(first: &str, rest: &str) -> Message {
    Message::new("rules.list-join")
        .arg("first", first)
        .arg("rest", rest)
}

/// コアが返す文（コードと値）と、辞書に移す前の日本語の文。辞書のキーごとに 1 つ以上。
fn cases() -> Vec<(Message, &'static str)> {
    let reason = || Message::verbatim("権限がありません");
    vec![
        (
            Message::new("rules.project-plugin-id-invalid").arg("id", "../evil"),
            "プラグインの ID「../evil」の形が正しくありません。英小文字・数字・「-」を「.」で区切って書いてください（例：jp.example.rules）",
        ),
        (
            Message::new("rules.plugin-not-installed")
                .arg("id", "jp.x")
                .arg("dir", ".modelith/plugins")
                .arg("file", "modelith-plugin.json"),
            "このプロジェクトで使うプラグイン「jp.x」が追加されていません。プラグインを .modelith/plugins/jp.x/ に追加してください（modelith-plugin.json が見つかりません）",
        ),
        (
            Message::new("rules.manifest-unreadable")
                .arg("id", "jp.x")
                .arg_message("reason", reason()),
            "プラグイン「jp.x」のマニフェストを読み込めません（権限がありません）",
        ),
        (
            Message::new("rules.rule-file-missing"),
            "マニフェストに書かれたルールのファイルが見つかりません（contributes.rules）",
        ),
        (
            Message::new("rules.rule-file-unreadable").arg_message("reason", reason()),
            "ルールのファイルを読み込めません（権限がありません）",
        ),
        (
            Message::new("rules.main-file-missing"),
            "マニフェストに書かれたプログラムのファイルが見つかりません（main）",
        ),
        (
            Message::new("rules.main-file-unreadable").arg_message("reason", reason()),
            "プログラムのファイルを読み込めません（権限がありません）",
        ),
        (
            Message::new("rules.api-version-unsupported")
                .arg("found", "1")
                .arg("supported", "0"),
            "対応していないバージョン（apiVersion「1」）のプラグインです。この Modelith が対応しているのは「0」です",
        ),
        (
            Message::new("rules.engines-mismatch")
                .arg("range", ">=9.0.0")
                .arg("host", "0.3.0-alpha.3"),
            "このプラグインが動く Modelith の版は「>=9.0.0」です。この Modelith（0.3.0-alpha.3）では動かしません",
        ),
        (
            Message::new("rules.engines-range-invalid").arg("range", "latest"),
            "動く Modelith の版の範囲（engines.modelith「latest」）の書き方が正しくありません。「>=0.1.0, <0.3.0」のように、比べる記号と版をカンマで区切って書いてください",
        ),
        (
            Message::new("rules.wasm-component-unsupported"),
            "WebAssembly で動くプラグイン（runtime: wasm-component）には、まだ対応していません",
        ),
        (
            Message::new("rules.id-mismatch")
                .arg("manifest", "jp.example.other")
                .arg("project", "jp.x"),
            "マニフェストの ID「jp.example.other」が、プロジェクトに書かれた ID「jp.x」と違います",
        ),
        (
            Message::new("rules.main-file-outside").arg("path", "../main.js"),
            "プログラムのファイル「../main.js」は、プラグインのフォルダの中を、そこからの相対パスで指してください",
        ),
        (
            Message::new("rules.main-file-required"),
            "画面に機能を追加するプラグイン（runtime: browser）には、プログラムのファイル（main）を書いてください",
        ),
        (
            Message::new("rules.rule-file-outside").arg("path", "../secret.yaml"),
            "ルールのファイル「../secret.yaml」は、プラグインのフォルダの中を、そこからの相対パスで指してください",
        ),
        (
            Message::new("rules.duplicate-id").arg("id", "x"),
            "ルールの ID「x」が重複しています。プラグインの中で 1 つにしてください",
        ),
        (
            Message::new("rules.in-rule")
                .arg("id", "r1")
                .arg_message("problem", Message::new("rules.kinds-empty")),
            "ルール「r1」：ルールを当てる要素の種類（match.kind）が空です。1 つ以上書いてください",
        ),
        (
            Message::new("rules.kinds-empty"),
            "ルールを当てる要素の種類（match.kind）が空です。1 つ以上書いてください",
        ),
        (
            Message::new("rules.kind-unknown")
                .arg("kind", "view def")
                .arg_message(
                    "allowed",
                    Message::new("rules.list-join")
                        .arg("first", "occurrence def")
                        .arg_message("rest", join("part def", "part")),
                ),
            "不明な要素の種類「view def」です（match.kind）。指定できる種類：occurrence def・part def・part",
        ),
        (
            Message::new("rules.ports-min-over-max")
                .arg("min", "3")
                .arg("max", "2")
                .arg("at", "require.not"),
            "ポートの数の下限（3）が上限（2）より大きいです（require.not.ports）",
        ),
        (
            Message::new("rules.relations-empty").arg("at", "require.outgoing"),
            "関係の種類（require.outgoing）が空です。1 つ以上書いてください",
        ),
        (
            Message::new("rules.relation-unknown")
                .arg("kind", "derive")
                .arg("at", "require.incoming")
                .arg("allowed", "satisfy"),
            "不明な関係の種類「derive」です（require.incoming）。指定できる種類：satisfy",
        ),
        (
            Message::new("rules.regex-invalid")
                .arg("at", "match.name")
                .arg("pattern", "[a")
                .arg("reason", "unclosed character class"),
            "名前の正規表現にエラーがあります（match.name「[a」：unclosed character class）",
        ),
        (join("satisfy", "verify"), "satisfy・verify"),
        (
            Message::new("rules.field-unknown").arg("key", "licence"),
            "不明な項目「licence」があります",
        ),
        (
            Message::new("rules.field-unknown-at")
                .arg("key", "incomin")
                .arg("place", "rules[0].require"),
            "不明な項目「incomin」があります（場所：rules[0].require）",
        ),
        (
            Message::new("rules.field-missing").arg("key", "severity"),
            "必要な項目「severity」がありません",
        ),
        (
            Message::new("rules.field-missing-at")
                .arg("key", "severity")
                .arg("place", "rules[0]"),
            "必要な項目「severity」がありません（場所：rules[0]）",
        ),
        (
            Message::new("rules.value-not-allowed").arg("value", "fatal"),
            "指定できない値「fatal」です",
        ),
        (
            Message::new("rules.value-not-allowed-at")
                .arg("value", "fatal")
                .arg("place", "rules[0].severity"),
            "指定できない値「fatal」です（場所：rules[0].severity）",
        ),
        (
            Message::new("rules.rule-id-invalid"),
            "ルールの ID は、英小文字・数字・「-」で書いてください（例：req-has-satisfier）",
        ),
        (
            Message::new("rules.plugin-id-invalid"),
            "プラグインの ID は、英小文字・数字・「-」を「.」で区切って書いてください（例：jp.example.rules）",
        ),
    ]
}

#[test]
fn rules_messages_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn the_whole_list_of_relations_is_joined_with_the_japanese_separator() {
    // Arrange（コアが作る入れ子と同じ形。5 つの名前）
    let allowed = Message::new("rules.list-join")
        .arg("first", "satisfy")
        .arg_message(
            "rest",
            Message::new("rules.list-join")
                .arg("first", "verify")
                .arg_message(
                    "rest",
                    Message::new("rules.list-join")
                        .arg("first", "frame")
                        .arg_message("rest", join("derivation", "flow")),
                ),
        );
    let message = Message::new("rules.in-rule").arg("id", "r1").arg_message(
        "problem",
        Message::new("rules.relation-unknown")
            .arg("kind", "derive")
            .arg("at", "require.incoming")
            .arg_message("allowed", allowed),
    );
    // Act
    let text = render(&message);
    // Assert
    assert_eq!(
        text,
        "ルール「r1」：不明な関係の種類「derive」です（require.incoming）。指定できる種類：satisfy・verify・frame・derivation・flow"
    );
}

#[test]
fn every_rules_key_is_checked_above() {
    // Arrange（辞書に足した文を、上の一覧に足し忘れない。辞書から消した文を、一覧に残さない）
    let mut checked: Vec<String> = cases()
        .iter()
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    checked.sort();
    checked.dedup();
    // Act
    let mut keys = keys();
    keys.sort_unstable();
    // Assert
    assert_eq!(keys, checked);
}
