//! 図からの操作を断る文（`locales/ja/edit.ftl`）を確かめる。
//! コアは種類のコードと値だけを返す（ADR-0027 §3）。ここでは、文にしたものが、辞書に移す前にコアが作っていた文と同じかを見る。
//! 言い回しを変えたら、ここが変わる。

use std::collections::BTreeSet;

use modelith_core::message::Message;
use modelith_messages::render;

/// 図からの操作を断る文の辞書（日本語）。
const FTL: &str = include_str!("../locales/ja/edit.ftl");

/// 辞書のキー（行の頭から「 =」の前まで）を、書いた順に並べる。
fn keys() -> Vec<&'static str> {
    FTL.lines()
        .filter(|line| line.starts_with(|c: char| c.is_ascii_lowercase()))
        .filter_map(|line| line.split_once(" =").map(|(key, _)| key))
        .collect()
}

/// コアが返す文（コードと値）と、辞書に移す前にコアが作っていた文。辞書のキーごとに 1 つ。
fn cases() -> Vec<(Message, &'static str)> {
    vec![
        (
            Message::new("edit.unbalanced"),
            "テキストに閉じていない括弧（{ }）やコメントがあるため、図から変更できません。テキストを直してから、もう一度操作してください",
        ),
        (
            Message::new("edit.in-other-file"),
            "この要素はほかのファイルにあります。そのファイルを開いて編集してください",
        ),
        (
            Message::new("edit.shown-in-other-file"),
            "この要素は、ほかのファイルの図に出しているので削除できません。先にそのファイルを開いて、図から外してください",
        ),
        (
            Message::new("edit.name-bad-character"),
            "名前に「'」「\\」や改行は使えません",
        ),
        (
            Message::new("edit.name-has-separator"),
            "名前に「::」は使えません（「::」は、パッケージの中の要素を指すときの区切りです）",
        ),
        (
            Message::new("edit.relation-exists"),
            "同じ関係が既にあります",
        ),
        (
            Message::new("edit.name-is-keyword").arg("name", "Lamp"),
            "「Lamp」はテキストの書き方で使う言葉なので、名前に使えません",
        ),
        (
            Message::new("edit.element-missing").arg("key", "P::Gone"),
            "操作する要素「P::Gone」が見つかりません。テキストが先に変わった可能性があります",
        ),
        (
            Message::new("edit.element-no-package"),
            "要素を配置するパッケージがありません",
        ),
        (Message::new("edit.name-empty"), "名前を入力してください"),
        (
            Message::new("edit.kind-not-addable").arg("kind", "widget"),
            "「widget」は、追加できる要素の種類ではありません",
        ),
        (
            Message::new("edit.name-taken").arg("name", "Lamp"),
            "「Lamp」は既に使われています",
        ),
        (
            Message::new("edit.package-name-invalid"),
            "パッケージ名は、英字か _ で始め、英字・数字・_ だけで付けてください",
        ),
        (
            Message::new("edit.relation-missing"),
            "操作する関係が見つかりません。テキストが先に変わった可能性があります",
        ),
        (
            Message::new("edit.flow-no-common-owner"),
            "2 つの部品を両方持つ部品定義がないため、流れを書けません",
        ),
        (
            Message::new("edit.relation-kind-unknown").arg("kind", "bogus"),
            "関係の種類「bogus」は扱えません",
        ),
        (
            Message::new("edit.relation-no-package"),
            "関係を追加するパッケージがありません",
        ),
        (
            Message::new("edit.state-marker-fixed"),
            "開始と終了の記号は、遷移から決まります。記号を消すときは、つながる遷移を削除してください",
        ),
        (
            Message::new("edit.transition-into-start"),
            "開始の記号へ向かう遷移は引けません",
        ),
        (
            Message::new("edit.transition-from-done"),
            "終了の記号から始まる遷移は引けません",
        ),
        (
            Message::new("edit.transition-second-entry"),
            "開始の記号からの遷移は、本体ごとに 1 つです。行き先を変えるときは、テキストの「entry; then …;」を書き換えてください",
        ),
        (
            Message::new("edit.transition-done-outside"),
            "終了の記号へは、同じ状態の中の状態からだけ遷移を引けます",
        ),
        (
            Message::new("edit.transition-exists"),
            "同じ遷移が既にあります。もう 1 つ足すときは、先にテキストで、いまの遷移にきっかけや条件を書いてください",
        ),
        (
            Message::new("edit.transition-unnamed-state"),
            "名前の無い状態は、図から遷移でつなげません。テキストで名前を付けてから線を引いてください",
        ),
        (
            Message::new("edit.succession-marker-fixed"),
            "開始と終了の記号は、順序の線から決まります。記号を消すときは、つながる線を削除してください",
        ),
        (
            Message::new("edit.succession-into-start"),
            "開始の記号へ向かう順序の線は引けません",
        ),
        (
            Message::new("edit.succession-from-done"),
            "終了の記号から始まる順序の線は引けません",
        ),
        (
            Message::new("edit.succession-across-actions"),
            "順序の線は、同じアクションの中の要素どうしにだけ引けます",
        ),
        (
            Message::new("edit.succession-unnamed"),
            "名前の無い要素は、図から順序の線でつなげません。テキストで名前を付けてから線を引いてください",
        ),
        (
            Message::new("edit.succession-exists"),
            "同じ順序の線が既にあります",
        ),
        (
            Message::new("edit.message-missing"),
            "操作するメッセージが見つかりません。テキストが先に変わった可能性があります",
        ),
        (
            Message::new("edit.not-a-message"),
            "メッセージではありません",
        ),
        (
            Message::new("edit.message-at-end"),
            "これ以上は動かせません",
        ),
        (
            Message::new("edit.phase-undefined"),
            "フェーズの定義がありません",
        ),
        (
            Message::new("edit.phase-inherited-cannot-clear"),
            "パッケージから継承しているため、ここでは外せません",
        ),
        (
            Message::new("edit.phase-already-inherited"),
            "すでにパッケージから継承しています",
        ),
        (
            Message::new("edit.phase-not-chosen"),
            "フェーズを選んでください",
        ),
        (
            Message::new("edit.phase-package-without-body"),
            "このファイルの書き方では、フェーズを足せません（最初の package が { } で囲まれていません）",
        ),
        (
            Message::new("edit.phase-no-package"),
            "フェーズを書き込むパッケージがありません",
        ),
        (
            Message::new("edit.port-missing").arg("port", "p"),
            "ポート「p」が見つかりません。テキストが先に変わった可能性があります",
        ),
        (
            Message::new("edit.port-name-invalid"),
            "ポート名は英字か _ で始め、英字・数字・_ だけで付けてください",
        ),
        (
            Message::new("edit.port-direction-unknown").arg("direction", "up"),
            "ポートの向き「up」は扱えません",
        ),
        (
            Message::new("edit.port-name-taken")
                .arg("name", "Lamp")
                .arg("owner", "Kettle"),
            "「Lamp」は Kettle の中で既に使われています",
        ),
        (
            Message::new("edit.view-missing").arg("name", "Lamp"),
            "図「Lamp」が見つかりません。テキストが先に変わった可能性があります",
        ),
        (
            Message::new("edit.view-name-empty"),
            "図の名前を入力してください",
        ),
        (
            Message::new("edit.view-exists").arg("name", "Lamp"),
            "「Lamp」という図は既にあります。別の名前にしてください",
        ),
        (
            Message::new("edit.view-kind-unknown").arg("kind", "widget"),
            "図の描き方「widget」は扱えません",
        ),
        (
            Message::new("edit.view-target-empty"),
            "図の対象を選んでください",
        ),
        (
            Message::new("edit.view-no-package"),
            "図を置くパッケージがありません。先にパッケージを作ってください",
        ),
        (
            Message::new("edit.view-name-is-element").arg("name", "Lamp"),
            "「Lamp」という名前の要素が既にあります。図には別の名前を付けてください",
        ),
        (
            Message::new("edit.view-name-is-package").arg("name", "Lamp"),
            "「Lamp」はパッケージの名前なので、図には別の名前を付けてください",
        ),
        (
            Message::new("edit.view-already-shows").arg("name", "Lamp"),
            "「Lamp」は既にこの図にあります",
        ),
        (
            Message::new("edit.view-shown-together").arg("name", "Lamp"),
            "「Lamp」は、ほかの要素とまとめてこの図に入っているため、1 つだけ外すことはできません（テキストの expose で直せます）",
        ),
        (
            Message::new("edit.view-name-not-found").arg("name", "全体"),
            "図「全体」の名前が見つかりません",
        ),
        (
            Message::new("edit.attribute-name-empty"),
            "属性の名前を入力してください",
        ),
        (
            Message::new("edit.attribute-text-invalid"),
            "型と値には「;」「{」「}」や改行は書けません（型には「=」も書けません）",
        ),
        (
            Message::new("edit.attribute-missing").arg("name", "mass"),
            "属性「mass」が見つかりません。テキストが先に変わった可能性があります",
        ),
        (
            Message::new("edit.attribute-exists").arg("name", "Lamp"),
            "「Lamp」という属性は既にあります",
        ),
        (
            Message::new("edit.attribute-has-body"),
            "この属性には中身があるため、テキストで直してください",
        ),
        (
            Message::new("edit.file-missing").arg("file", "nope.sysml"),
            "ファイル「nope.sysml」が見つかりません",
        ),
    ]
}

#[test]
fn edit_refusals_are_the_japanese_sentences() {
    // Arrange
    let cases = cases();
    // Act
    let got: Vec<String> = cases.iter().map(|(message, _)| render(message)).collect();
    // Assert
    let want: Vec<&str> = cases.iter().map(|(_, text)| *text).collect();
    assert_eq!(got, want);
}

#[test]
fn every_edit_key_is_checked_above() {
    // Arrange（辞書に足した文を、上のケースに足し忘れない。辞書に無いコードのケースも残さない）
    let in_file: BTreeSet<String> = keys().into_iter().map(str::to_owned).collect();
    // Act
    let checked: BTreeSet<String> = cases()
        .iter()
        .map(|(message, _)| message.code.replace('.', "-"))
        .collect();
    // Assert（同じキーを 2 回書いていないことも、数で確かめる）
    assert_eq!(checked, in_file);
    assert_eq!(keys().len(), in_file.len());
    assert_eq!(cases().len(), in_file.len());
}

#[test]
fn keys_that_take_values_fall_back_without_them_and_the_others_take_none() {
    // Arrange（値を取る文は、値なしでは決まった形に戻る。値を取らない文は、値なしで文になる）
    let cases = cases();
    // Act
    let wrong: Vec<&str> = cases
        .iter()
        .filter(|(message, _)| {
            let bare = Message::new(message.code);
            let fell_back = render(&bare) == bare.fallback();
            fell_back == message.args.is_empty()
        })
        .map(|(message, _)| message.code)
        .collect();
    // Assert
    assert_eq!(wrong, Vec::<&str>::new());
}

#[test]
fn values_are_put_in_as_they_are() {
    // Arrange（境界値：空の値・空白を含む名前・辞書の書き方に見える値）
    let empty = Message::new("edit.element-missing").arg("key", "");
    let spaced = Message::new("edit.name-taken").arg("name", "電気 ケトル");
    let braces = Message::new("edit.view-missing").arg("name", "{ $name } 'a' \\");
    // Act
    let got = [render(&empty), render(&spaced), render(&braces)];
    // Assert
    assert_eq!(
        got,
        [
            "操作する要素「」が見つかりません。テキストが先に変わった可能性があります",
            "「電気 ケトル」は既に使われています",
            "図「{ $name } 'a' \\」が見つかりません。テキストが先に変わった可能性があります",
        ]
    );
}

#[test]
fn a_wrong_value_name_falls_back_to_the_code_and_values() {
    // Arrange（異常系：値の名前が足りない）
    let message = Message::new("edit.port-name-taken").arg("name", "p");
    // Act
    let text = render(&message);
    // Assert
    assert_eq!(text, "edit.port-name-taken{name=p}");
}
