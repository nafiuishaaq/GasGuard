//! Domain-Specific Language (DSL) for defining GasGuard analysis rules.
//!
//! # Overview
//!
//! The DSL lets you write rules in a concise, declarative syntax instead of
//! hand-coding Rust structs.  A rule file is plain text that the compiler
//! turns into a [`BaseRule`] implementation ready for the [`PluginRegistry`].
//!
//! # Quick start
//!
//! ```rust
//! use analysis_core::dsl::compiler::compile_str;
//! use analysis_core::plugin::{PluginRegistry, AnalysisInput};
//!
//! let rules = compile_str(r#"
//!     rule no-unsafe {
//!         name:        "No Unsafe Blocks"
//!         description: "Flags unsafe blocks in Rust source files"
//!         severity:    error
//!         language:    rust
//!         when {
//!             contains_pattern("unsafe")
//!         }
//!         message:    "Unsafe block detected at line {line}: {snippet}"
//!         suggestion: "Wrap the operation in a safe abstraction"
//!     }
//! "#).unwrap();
//!
//! let mut registry = PluginRegistry::new();
//! for rule in rules {
//!     registry.register_default(rule).unwrap();
//! }
//!
//! let inputs = vec![AnalysisInput::new("src/main.rs", "fn main() { unsafe {} }")];
//! let session = registry.run_session(&inputs);
//! assert!(!session.is_clean());
//! ```
//!
//! # DSL syntax
//!
//! ```text
//! rule <id> {
//!     name:        "<string>"
//!     description: "<string>"
//!     severity:    info | warning | error | critical
//!     language:    solidity | rust | vyper | any   // default: any
//!     tags:        [<ident>, ...]                  // optional
//!
//!     when {
//!         <condition>
//!     }
//!
//!     message:    "<string>"   // supports {line}, {file}, {snippet}
//!     suggestion: "<string>"   // optional
//! }
//! ```
//!
//! ## Conditions
//!
//! Conditions are boolean expressions built from predicate calls:
//!
//! ```text
//! contains_pattern("unsafe")
//! has_keyword("loop") and not contains_pattern("break")
//! line_count_exceeds(500) or nesting_depth_exceeds(5)
//! (contains_pattern("todo") or contains_pattern("fixme")) and not has_keyword("resolved")
//! ```
//!
//! ## Built-in predicates
//!
//! | Predicate | Args | Description |
//! |-----------|------|-------------|
//! | `contains_pattern(pat)` | regex string | Fires on every line matching the pattern |
//! | `matches_regex(pat)` | regex string | Alias for `contains_pattern` |
//! | `has_keyword(kw)` | string/ident | Whole-word keyword match |
//! | `lacks_keyword(kw)` | string/ident | Fires once if keyword is absent |
//! | `line_count_exceeds(n)` | integer | Fires if file has > n lines |
//! | `function_count_exceeds(n)` | integer | Fires if file has > n function definitions |
//! | `identifier_matches(pat)` | regex string | Fires on every matching identifier |
//! | `comment_ratio_below(r)` | float 0–1 | Fires if comment ratio < r |
//! | `nesting_depth_exceeds(n)` | integer | Fires if max brace depth > n |
//! | `always()` | — | Always fires (unconditional rule) |
//! | `never()` | — | Never fires (disabled rule) |

pub mod ast;
pub mod builtins;
pub mod compiler;
pub mod error;
pub mod lexer;
pub mod parser;

#[cfg(test)]
mod verification_test;

// Convenience re-exports
pub use ast::{Arg, Condition, DslFile, DslLanguage, DslSeverity, RuleDefinition};
pub use builtins::{evaluate as eval_predicate, EvalContext, PredicateMatch};
pub use compiler::compile_str;
pub use error::{DslError, DslResult, Span};
pub use lexer::{Lexer, Token, TokenKind};
pub use parser::Parser;
