//! 確かめる操作（ADR-0024 の 1。要求 F-AI-1）。プロジェクトの問題一覧を、契約の `ProblemReport` で返す。
//!
//! 数え方は画面の問題一覧と同じ（`rules::check_files`）：ファイルごとに、ほかのファイルとつないだモデルで、
//! そのファイルの問題（構文エラー・見つからない相手・まだ扱えない書き方・トレースの抜け）とチェックルールの結果を数え、
//! プロジェクトで選んだ知らせの重さを当てる（F-EDIT-11）。

use std::collections::BTreeMap;

use modelith_plugin_protocol::{Diagnostic, DiagnosticSeverity, Position, ProblemReport, Range};

use super::SourceFile;
use crate::Message;
use crate::levels::{self, KINDS, Levels};
use crate::model::Problem;
use crate::plugin_host::Positions;
use crate::project::merge::Files;
use crate::project_file::{self, Level};
use crate::rules::{self, Finding, LoadProblem, LoadedPlugin, Place};

/// モデルの問題の報告元（`Diagnostic.source`）。チェックルールの結果は、プラグインの ID が入る。
pub const SOURCE: &str = "modelith";

/// プロジェクトの問題一覧を返す。
///
/// # 引数
///
/// - `files`：プロジェクトのファイル
/// - `plugins`：当てるプラグイン（有効なものだけを渡す）
/// - `levels`：プロジェクトで選んだ知らせの重さ（選んでいなければ空）
///
/// # 戻り値
///
/// 問題（ファイルのパスの順。ファイルの中は、モデルの問題、チェックルールの結果の順）。
/// 位置は問題の始まり（幅の無い範囲）。モデルの問題の `source` は `modelith`、`code` は知らせの種類（`trace.verify` など。エラーは無し）。
/// チェックルールの結果の `source` はプラグインの ID、`code` はルールの ID。「出さない」を選んだ種類は入らない。
///
/// # 例
///
/// ```text
/// problems([a.sysml「package P { part x : Nope; }」], &[], &{})
///   → [{ file: "a.sysml", diagnostic: { range: 0:12–0:12, severity: error, message: "型「Nope」が見つかりません（x）", source: "modelith" } }]
/// problems([], &[], &{}) → []
/// ```
pub fn problems(
    files: &[SourceFile<'_>],
    plugins: &[LoadedPlugin],
    levels: &Levels,
) -> Vec<ProblemReport> {
    let mut store = Files::default();
    for f in files {
        store.set(f.path, f.text);
    }
    let mut out = Vec::new();
    for report in rules::check_files(&store, None, plugins) {
        // check_files は覚えたファイルだけを返すので、テキストは必ず見つかる
        let Some(file) = files.iter().find(|f| f.path == report.path) else {
            continue;
        };
        let positions = Positions::new(file.text);
        let at = |pos: usize| {
            let p = positions.position(pos);
            Range { start: p, end: p }
        };
        out.extend(
            levels::apply_problems(report.problems, levels)
                .iter()
                .map(|p| ProblemReport {
                    file: report.path.clone(),
                    diagnostic: model_diagnostic(p, at(p.pos)),
                }),
        );
        out.extend(
            levels::apply_findings(report.findings, levels)
                .into_iter()
                .map(|f| ProblemReport {
                    file: report.path.clone(),
                    diagnostic: rule_diagnostic(at(f.pos), f),
                }),
        );
    }
    out
}

/// プロジェクトの設定ファイルの名前（プロジェクトのフォルダの直下）。
pub const PROJECT_FILE: &str = "modelith.json";

/// 確かめる対象のプロジェクト（呼ぶ側が読んで渡す。ここではファイルを読まない）。
#[derive(Debug, Clone, Copy)]
pub struct Project<'a> {
    /// モデルのファイル。
    pub files: &'a [SourceFile<'a>],
    /// プロジェクトの設定ファイル（`modelith.json`）のテキスト。無ければ `None`（プラグインも重さの選択も無いものとする）。
    pub project_file: Option<&'a str>,
    /// プラグインのファイル（プラグインの ID → プラグインのフォルダからの相対パス → テキスト）。
    pub plugin_files: &'a BTreeMap<String, BTreeMap<String, String>>,
}

/// プロジェクトを確かめる：設定ファイルの問題、有効なプラグインの読み込みの問題、モデルの問題とチェックルールの結果を返す
/// （`modelith check` と同じ材料。設定ファイルが読めなくても、モデルの問題は返す）。
///
/// # 引数
///
/// - `project`：モデルのファイル・設定ファイルのテキスト・プラグインのファイル
///
/// # 戻り値
///
/// 問題（設定ファイル、プラグインの読み込み、[`problems`] の順）。設定ファイルとプラグインの問題の `source` は `modelith`、`code` は無い。
/// ファイル全体の問題（プラグインが入っていないなど）は、位置を先頭（0:0）にする。
///
/// # 例
///
/// ```text
/// // modelith.json が「{ "plugins": { "jp.x": {} } }」で、jp.x のファイルが無いとき
/// check(project) → [{ file: ".modelith/plugins/jp.x/modelith-plugin.json", diagnostic: { range: 0:0–0:0, severity: error, message: "…入っていません…" } }, …モデルの問題]
/// // 設定ファイルが無いとき
/// check(project) → problems(files, &[], &{}) と同じ
/// ```
pub fn check(project: &Project<'_>) -> Vec<ProblemReport> {
    let parsed = project.project_file.map(project_file::parse);
    let mut out: Vec<ProblemReport> = parsed
        .iter()
        .flat_map(|p| &p.problems)
        .map(|p| ProblemReport {
            file: PROJECT_FILE.to_owned(),
            diagnostic: setting_diagnostic(
                Some(Place {
                    line: p.line,
                    column: p.column,
                }),
                match p.severity {
                    project_file::Severity::Error => DiagnosticSeverity::Error,
                    project_file::Severity::Warning => DiagnosticSeverity::Warning,
                },
                &p.message,
            ),
        })
        .collect();
    let settings = parsed.and_then(|p| p.project);
    let none = BTreeMap::new();
    let plugins: Vec<LoadedPlugin> = settings
        .iter()
        .flat_map(|s| &s.plugins)
        .filter(|(_, used)| used.enabled)
        .map(|(id, _)| rules::load_plugin_files(id, project.plugin_files.get(id).unwrap_or(&none)))
        .collect();
    out.extend(plugins.iter().flat_map(|p| &p.problems).map(load_report));
    let levels = settings.map(|s| s.levels).unwrap_or_default();
    out.extend(problems(project.files, &plugins, &levels));
    out
}

/// プラグインの読み込みの問題を、契約の報告にする（どれも誤り）。
///
/// # 引数
///
/// - `p`：読み込みの問題
///
/// # 戻り値
///
/// 報告（ファイルは問題のあるファイル）。
///
/// # 例
///
/// ```text
/// load_report(rules.yaml の 3 行目 5 列の問題) → { file: ".modelith/plugins/jp.x/rules.yaml", diagnostic: { range: 2:4–2:4, severity: error, … } }
/// ```
fn load_report(p: &LoadProblem) -> ProblemReport {
    ProblemReport {
        file: p.path.clone(),
        diagnostic: setting_diagnostic(p.place, DiagnosticSeverity::Error, &p.message),
    }
}

/// 設定ファイルやプラグインのファイルの問題を、契約の診断にする。
///
/// # 引数
///
/// - `place`：1 始まりの行・列。ファイル全体の問題なら `None`
/// - `severity`：重さ
/// - `message`：文
///
/// # 戻り値
///
/// 診断（位置は 0 始まりに直す。`None` は先頭）。
///
/// # 例
///
/// ```text
/// setting_diagnostic(Some(3 行 5 列), Error, "m") → range: 2:4–2:4
/// setting_diagnostic(None, Error, "m")            → range: 0:0–0:0
/// ```
fn setting_diagnostic(
    place: Option<Place>,
    severity: DiagnosticSeverity,
    message: &Message,
) -> Diagnostic {
    let at = place.map_or(
        Position {
            line: 0,
            character: 0,
        },
        |p| Position {
            line: p.line.saturating_sub(1),
            character: p.column.saturating_sub(1),
        },
    );
    Diagnostic {
        range: Range { start: at, end: at },
        severity,
        message: message.render(),
        code: None,
        source: Some(SOURCE.to_owned()),
    }
}

/// モデルの問題を、契約の診断にする。
///
/// # 引数
///
/// - `p`：モデルの問題（重さを当てたあと）
/// - `range`：問題の位置
///
/// # 戻り値
///
/// 診断。重さは、選んだ重さ、無ければその種類の既定、種類の無い問題（構文エラーなど）はエラー。
///
/// # 例
///
/// ```text
/// model_diagnostic(型が見つからない問題, r)        → severity: error、code: なし、source: "modelith"
/// model_diagnostic(検証の抜け（既定の重さ）, r)    → severity: warning、code: "trace.verify"
/// model_diagnostic(検証の抜け（level: "error"）, r) → severity: error、code: "trace.verify"
/// ```
fn model_diagnostic(p: &Problem, range: Range) -> Diagnostic {
    let chosen = p.level.map(|l| match l {
        "error" => DiagnosticSeverity::Error,
        "warning" => DiagnosticSeverity::Warning,
        _ => DiagnosticSeverity::Information,
    });
    Diagnostic {
        range,
        severity: chosen.unwrap_or_else(|| default_severity(p.code)),
        message: p.msg.render(),
        code: p.code.map(str::to_owned),
        source: Some(SOURCE.to_owned()),
    }
}

/// 知らせの種類の、既定の重さ。
///
/// # 引数
///
/// - `code`：知らせの種類（エラーは None）
///
/// # 戻り値
///
/// 既定の重さ。種類が無い・知らない種類ならエラー。
///
/// # 例
///
/// ```text
/// default_severity(Some("trace.verify")) → Warning
/// default_severity(Some("unsupported"))  → Information
/// default_severity(None)                 → Error
/// ```
fn default_severity(code: Option<&str>) -> DiagnosticSeverity {
    match KINDS
        .iter()
        .find(|k| Some(k.code) == code)
        .map(|k| k.default)
    {
        Some(Level::Warning) => DiagnosticSeverity::Warning,
        Some(Level::Info) => DiagnosticSeverity::Information,
        _ => DiagnosticSeverity::Error,
    }
}

/// チェックルールの結果を、契約の診断にする。
///
/// # 引数
///
/// - `range`：結果の位置
/// - `f`：チェックルールの結果（重さを当てたあと）
///
/// # 戻り値
///
/// 診断（`code` はルールの ID、`source` はプラグインの ID）。
///
/// # 例
///
/// ```text
/// rule_diagnostic(r, jp.x の r1 の警告「part def「A」に説明がありません」)
///   → { severity: warning, message: "part def「A」に説明がありません", code: "r1", source: "jp.x" }
/// ```
fn rule_diagnostic(range: Range, f: Finding) -> Diagnostic {
    Diagnostic {
        range,
        severity: f.severity,
        message: f.message,
        code: Some(f.rule),
        source: Some(f.plugin),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    const ID: &str = "jp.example.rules";

    /// 「部品定義には、満たす要求が要る」というルール 1 つ（警告）のプラグインを読み込む。
    fn plugin() -> LoadedPlugin {
        let manifest = format!(
            "{{ \"id\": \"{ID}\", \"name\": \"例\", \"version\": \"0.1.0\", \"apiVersion\": \"0\", \"runtime\": \"rules\", \"license\": \"MIT\", \"contributes\": {{ \"rules\": [\"rules.yaml\"] }} }}"
        );
        let yaml = "rules:\n  - id: r1\n    severity: warning\n    message: \"{kind}「{name}」は要求を満たしていません\"\n    match:\n      kind: part def\n    require:\n      outgoing: satisfy\n";
        let files = BTreeMap::from([
            ("modelith-plugin.json".to_owned(), manifest),
            ("rules.yaml".to_owned(), yaml.to_owned()),
        ]);
        let loaded = rules::load_plugin_files(ID, &files);
        assert!(loaded.problems.is_empty(), "{:?}", loaded.problems);
        loaded
    }

    /// 工程を持つ要求 2 つ（上位の Need と、部品 A が満たす R。R を確かめる検証は無い）のモデル。`extra` を 7 行目（0 始まり）に足す。
    fn phased(extra: &str) -> String {
        format!(
            "package P {{\n    enum def Stage {{ enum concept; enum detail; }}\n    metadata def Phase {{ attribute stage : Stage; }}\n    requirement def Need {{ @Phase {{ stage = concept; }} }}\n    requirement def R {{ @Phase {{ stage = detail; }} }}\n    #derivation dependency from Need to R;\n    part def A; satisfy R by A;\n{extra}}}\n"
        )
    }

    /// 問題を「ファイル 行:列 重さ 文 [code] [source]」の形にする。導出の抜け（`trace.derive`）は、どのテストでも見ないので除く。
    fn lines(reports: &[ProblemReport]) -> Vec<String> {
        reports
            .iter()
            .filter(|r| r.diagnostic.code.as_deref() != Some("trace.derive"))
            .map(|r| {
                let d = &r.diagnostic;
                assert_eq!(d.range.start, d.range.end);
                format!(
                    "{} {}:{} {:?} {} [{}] [{}]",
                    r.file,
                    d.range.start.line,
                    d.range.start.character,
                    d.severity,
                    d.message,
                    d.code.as_deref().unwrap_or("-"),
                    d.source.as_deref().unwrap_or("-")
                )
            })
            .collect()
    }

    // --- 正常系 ---

    #[test]
    fn reports_model_problems_with_file_position_and_default_severity() {
        // Arrange（見つからない型はエラー、検証の無い要求は警告）
        let text = phased("    part x : Nope;\n");
        let files = [SourceFile {
            path: "a.sysml",
            text: &text,
        }];
        // Act
        let got = lines(&problems(&files, &[], &Levels::new()));
        // Assert
        assert_eq!(
            got,
            [
                "a.sysml 7:4 Error 型「Nope」が見つかりません（x） [-] [modelith]",
                "a.sysml 4:4 Warning R：この要求を確かめる検証がありません（verify） [trace.verify] [modelith]",
            ]
        );
    }

    #[test]
    fn reports_rule_findings_after_the_model_problems_of_each_file() {
        // Arrange
        let files = [SourceFile {
            path: "a.sysml",
            text: "package P {\n    part def A;\n    part x : Nope;\n}\n",
        }];
        // Act
        let got = lines(&problems(&files, &[plugin()], &Levels::new()));
        // Assert
        assert_eq!(
            got,
            [
                "a.sysml 2:4 Error 型「Nope」が見つかりません（x） [-] [modelith]",
                "a.sysml 1:4 Warning part def「A」は要求を満たしていません [r1] [jp.example.rules]",
            ]
        );
    }

    #[test]
    fn counts_each_file_against_the_whole_project() {
        // Arrange（b.sysml の型は a.sysml にある。c.sysml の型はどこにも無い）
        let files = [
            SourceFile {
                path: "c.sysml",
                text: "package C { part y : A::Nope; }",
            },
            SourceFile {
                path: "a.sysml",
                text: "package A { part def Wheel; }",
            },
            SourceFile {
                path: "b.sysml",
                text: "package B { part w : A::Wheel; }",
            },
        ];
        // Act
        let got = lines(&problems(&files, &[], &Levels::new()));
        // Assert（パスの順。a・b には問題が無い）
        assert_eq!(got.len(), 1, "{got:?}");
        assert!(got[0].starts_with("c.sysml 0:12 Error "), "{got:?}");
    }

    #[test]
    fn applies_the_chosen_levels() {
        // Arrange（検証の抜けをエラーに、ルール r1 を「出さない」に）
        let text = phased("    part def B;\n");
        let files = [SourceFile {
            path: "a.sysml",
            text: &text,
        }];
        let levels = Levels::from([
            ("trace.verify".to_owned(), Level::Error),
            (levels::rule_kind(ID, "r1"), Level::Off),
        ]);
        // Act
        let default = lines(&problems(&files, &[plugin()], &Levels::new()));
        let chosen = lines(&problems(&files, &[plugin()], &levels));
        // Assert
        assert_eq!(
            default,
            [
                "a.sysml 4:4 Warning R：この要求を確かめる検証がありません（verify） [trace.verify] [modelith]",
                "a.sysml 7:4 Warning part def「B」は要求を満たしていません [r1] [jp.example.rules]",
            ]
        );
        assert_eq!(
            chosen,
            [
                "a.sysml 4:4 Error R：この要求を確かめる検証がありません（verify） [trace.verify] [modelith]"
            ]
        );
    }

    // --- 境界値・異常系 ---

    #[test]
    fn no_files_and_clean_files_give_no_problems() {
        // Arrange
        let none: [SourceFile<'_>; 0] = [];
        let clean = [SourceFile {
            path: "a.sysml",
            text: "package P { part def A; }",
        }];
        // Act
        let a = problems(&none, &[], &Levels::new());
        let b = problems(&clean, &[], &Levels::new());
        // Assert
        assert!(a.is_empty() && b.is_empty(), "{a:?} {b:?}");
    }

    #[test]
    fn reports_syntax_errors_and_unsupported_text() {
        // Arrange（閉じていない括弧と、まだ扱えない書き方）
        let files = [SourceFile {
            path: "a.sysml",
            text: "package P {\n    part def A {\n",
        }];
        // Act
        let got = problems(&files, &[], &Levels::new());
        // Assert
        assert!(
            got.iter()
                .any(|r| r.diagnostic.severity == DiagnosticSeverity::Error
                    && r.diagnostic.code.is_none()),
            "{got:?}"
        );
    }

    // --- check：設定ファイルとプラグイン ---

    /// ルール 1 つのプラグインのファイル（プラグインの ID → 相対パス → テキスト）。
    fn plugin_files() -> BTreeMap<String, BTreeMap<String, String>> {
        let manifest = format!(
            "{{ \"id\": \"{ID}\", \"name\": \"例\", \"version\": \"0.1.0\", \"apiVersion\": \"0\", \"runtime\": \"rules\", \"license\": \"MIT\", \"contributes\": {{ \"rules\": [\"rules.yaml\"] }} }}"
        );
        let yaml = "rules:\n  - id: r1\n    severity: warning\n    message: \"{kind}「{name}」は要求を満たしていません\"\n    match:\n      kind: part def\n    require:\n      outgoing: satisfy\n";
        BTreeMap::from([(
            ID.to_owned(),
            BTreeMap::from([
                ("modelith-plugin.json".to_owned(), manifest),
                ("rules.yaml".to_owned(), yaml.to_owned()),
            ]),
        )])
    }

    const ONE: [SourceFile<'static>; 1] = [SourceFile {
        path: "a.sysml",
        text: "package P {\n    part def A;\n}\n",
    }];

    #[test]
    fn check_uses_the_enabled_plugins_and_levels_of_the_project_file() {
        // Arrange
        let files = plugin_files();
        let on = format!("{{ \"plugins\": {{ \"{ID}\": {{}} }} }}");
        let off = format!("{{ \"plugins\": {{ \"{ID}\": {{ \"enabled\": false }} }} }}");
        let error = format!(
            "{{ \"plugins\": {{ \"{ID}\": {{}} }}, \"levels\": {{ \"{ID}/r1\": \"error\" }} }}"
        );
        let run = |text: &str| {
            lines(&check(&Project {
                files: &ONE,
                project_file: Some(text),
                plugin_files: &files,
            }))
        };
        // Act
        let (on, off, error) = (run(&on), run(&off), run(&error));
        // Assert
        assert_eq!(
            on,
            ["a.sysml 1:4 Warning part def「A」は要求を満たしていません [r1] [jp.example.rules]"]
        );
        assert!(off.is_empty(), "{off:?}");
        assert_eq!(
            error,
            ["a.sysml 1:4 Error part def「A」は要求を満たしていません [r1] [jp.example.rules]"]
        );
    }

    #[test]
    fn check_without_a_project_file_reports_only_the_model() {
        // Arrange（設定ファイルが無ければ、プラグインのファイルがあっても使わない）
        let files = plugin_files();
        let broken = [SourceFile {
            path: "a.sysml",
            text: "package P { part x : Nope; }",
        }];
        // Act
        let got = lines(&check(&Project {
            files: &broken,
            project_file: None,
            plugin_files: &files,
        }));
        // Assert
        assert_eq!(
            got,
            ["a.sysml 0:12 Error 型「Nope」が見つかりません（x） [-] [modelith]"]
        );
    }

    #[test]
    fn check_reports_a_plugin_that_is_not_installed_and_a_broken_project_file() {
        // Arrange（プラグインのファイルが無い。設定ファイルが JSON でない）
        let none = BTreeMap::new();
        let missing = format!("{{ \"plugins\": {{ \"{ID}\": {{}} }} }}");
        let run = |text: &str| {
            check(&Project {
                files: &ONE,
                project_file: Some(text),
                plugin_files: &none,
            })
        };
        // Act
        let (missing, broken) = (run(&missing), run("{\n  \"plugins\": [\n"));
        // Assert
        assert_eq!(missing.len(), 1, "{missing:?}");
        assert_eq!(
            (
                missing[0].file.as_str(),
                missing[0].diagnostic.severity,
                missing[0].diagnostic.range.start
            ),
            (
                ".modelith/plugins/jp.example.rules/modelith-plugin.json",
                DiagnosticSeverity::Error,
                Position {
                    line: 0,
                    character: 0
                }
            )
        );
        assert_eq!(broken.len(), 1, "{broken:?}");
        assert_eq!(
            (broken[0].file.as_str(), broken[0].diagnostic.severity),
            (PROJECT_FILE, DiagnosticSeverity::Error)
        );
    }

    #[test]
    fn setting_diagnostic_turns_one_based_places_into_zero_based_positions() {
        // Arrange（境界値: 1 行 1 列、位置なし）
        let first = Some(Place { line: 1, column: 1 });
        let third = Some(Place { line: 3, column: 5 });
        // Act
        let got = [first, third, None].map(|p| {
            setting_diagnostic(p, DiagnosticSeverity::Error, &Message::verbatim("m"))
                .range
                .start
        });
        // Assert
        assert_eq!(
            got,
            [
                Position {
                    line: 0,
                    character: 0
                },
                Position {
                    line: 2,
                    character: 4
                },
                Position {
                    line: 0,
                    character: 0
                }
            ]
        );
    }

    #[test]
    fn default_severity_follows_the_kind() {
        // Arrange
        let codes = [
            Some("trace.derive"),
            Some("unsupported"),
            Some("unknown.kind"),
            None,
        ];
        // Act
        let got = codes.map(default_severity);
        // Assert
        assert_eq!(
            got,
            [
                DiagnosticSeverity::Warning,
                DiagnosticSeverity::Information,
                DiagnosticSeverity::Error,
                DiagnosticSeverity::Error
            ]
        );
    }
}
