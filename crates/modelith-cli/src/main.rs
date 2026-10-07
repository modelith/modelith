//! `modelith` CLI。P3 で `check` / `export` / MCP(stdio) を実装する。

use std::process::ExitCode;

fn main() -> ExitCode {
    match std::env::args().nth(1).as_deref() {
        Some("--version" | "-V") => {
            println!("modelith {}", modelith_core::VERSION);
            ExitCode::SUCCESS
        }
        _ => {
            eprintln!("usage: modelith --version");
            ExitCode::from(2)
        }
    }
}
