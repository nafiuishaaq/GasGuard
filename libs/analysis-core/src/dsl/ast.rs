//! DSL Abstract Syntax Tree.
//!
//! This module defines the in-memory representation of a parsed GasGuard DSL
//! rule definition.  The compiler (`compiler.rs`) walks this tree and produces
//! a concrete [`BaseRule`] implementation.
//!
//! # Grammar overview
//!
//! ```text
//! rule <id> {
//!     name:        "<string>"
//!     description: "<string>"
//!     severity:    info | warning | error | critical
//!     language:    solidity | rust | vyper | any
//!     tags:        [<ident>, ...]          // optional
//!
//!     when {
//!         <condition>
//!     }
//!
//!     message:    "<string>"
//!     suggestion: "<string>"              // optional
//! }
//! ```
//!
//! A `<condition>` is a boolean expression tree:
//!
//! ```text
//! condition  ::= or_expr
//! or_expr    ::= and_expr ( "or" and_expr )*
//! and_expr   ::= unary    ( "and" unary )*
//! unary      ::= "not" unary | primary
//! primary    ::= predicate_call | "(" condition ")"
//! predicate_call ::= <ident> "(" arg_list? ")"
//! arg_list   ::= arg ( "," arg )*
//! arg        ::= string | int | float | bool | ident
//! ```

use super::error::Span;

// ---------------------------------------------------------------------------
// Severity / Language enums (DSL-level, before compilation)
// ---------------------------------------------------------------------------

/// Severity level as written in the DSL.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DslSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl std::fmt::Display for DslSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DslSeverity::Info => write!(f, "info"),
            DslSeverity::Warning => write!(f, "warning"),
            DslSeverity::Error => write!(f, "error"),
            DslSeverity::Critical => write!(f, "critical"),
        }
    }
}

/// Target language as written in the DSL.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DslLanguage {
    Solidity,
    Rust,
    Vyper,
    /// Matches any language.
    Any,
}

impl std::fmt::Display for DslLanguage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DslLanguage::Solidity => write!(f, "solidity"),
            DslLanguage::Rust => write!(f, "rust"),
            DslLanguage::Vyper => write!(f, "vyper"),
            DslLanguage::Any => write!(f, "any"),
        }
    }
}

// ---------------------------------------------------------------------------
// Predicate arguments
// ---------------------------------------------------------------------------

/// A single argument passed to a predicate call.
#[derive(Debug, Clone, PartialEq)]
pub enum Arg {
    String(String),
    Int(i64),
    Float(f64),
    Bool(bool),
    /// Bare identifier used as a symbolic value (e.g. `public`, `external`).
    Ident(String),
}

impl std::fmt::Display for Arg {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Arg::String(s) => write!(f, "\"{}\"", s),
            Arg::Int(n) => write!(f, "{}", n),
            Arg::Float(n) => write!(f, "{}", n),
            Arg::Bool(b) => write!(f, "{}", b),
            Arg::Ident(s) => write!(f, "{}", s),
        }
    }
}

// ---------------------------------------------------------------------------
// Condition expression tree
// ---------------------------------------------------------------------------

/// A boolean condition expression in the `when` block.
#[derive(Debug, Clone)]
pub enum Condition {
    /// A predicate call: `predicate_name(arg1, arg2, ...)`.
    Predicate {
        name: String,
        args: Vec<Arg>,
        span: Span,
    },
    /// Logical AND of two conditions.
    And(Box<Condition>, Box<Condition>),
    /// Logical OR of two conditions.
    Or(Box<Condition>, Box<Condition>),
    /// Logical NOT of a condition.
    Not(Box<Condition>),
}

impl Condition {
    /// Recursively collect all predicate names referenced in this condition.
    pub fn predicate_names(&self) -> Vec<&str> {
        match self {
            Condition::Predicate { name, .. } => vec![name.as_str()],
            Condition::And(l, r) | Condition::Or(l, r) => {
                let mut names = l.predicate_names();
                names.extend(r.predicate_names());
                names
            }
            Condition::Not(inner) => inner.predicate_names(),
        }
    }
}

// ---------------------------------------------------------------------------
// Top-level rule definition
// ---------------------------------------------------------------------------

/// A fully parsed DSL rule definition.
#[derive(Debug, Clone)]
pub struct RuleDefinition {
    /// Stable unique identifier (the `<id>` after `rule`).
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Detailed description.
    pub description: String,
    /// Severity of findings produced by this rule.
    pub severity: DslSeverity,
    /// Target language(s).
    pub language: DslLanguage,
    /// Optional tags for grouping / filtering.
    pub tags: Vec<String>,
    /// The boolean condition that must hold for a finding to be emitted.
    pub condition: Condition,
    /// Message template for findings.  May contain `{variable}` placeholders.
    pub message: String,
    /// Optional suggestion template.
    pub suggestion: Option<String>,
    /// Source span of the entire rule block.
    pub span: Span,
}

/// A DSL source file may contain multiple rule definitions.
#[derive(Debug, Clone)]
pub struct DslFile {
    pub rules: Vec<RuleDefinition>,
}
