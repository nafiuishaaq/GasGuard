// Example DSL rules demonstrating the syntax and capabilities

// Simple rule to detect unsafe blocks in Rust
rule no-unsafe-blocks {
    name:        "No Unsafe Blocks"
    description: "Flags unsafe blocks in Rust source files"
    severity:    error
    language:    rust
    when {
        contains_pattern("unsafe")
    }
    message:    "Unsafe block detected at line {line}: {snippet}"
    suggestion: "Wrap the operation in a safe abstraction"
}

// Rule with complex condition using AND/OR/NOT
rule unsafe-without-wrapper {
    name:        "Unsafe Without Safe Wrapper"
    description: "Detects unsafe code that is not wrapped in a safe abstraction"
    severity:    warning
    language:    rust
    when {
        contains_pattern("unsafe") and not contains_pattern("safe_wrapper")
    }
    message:    "Unsafe usage without safe wrapper at line {line}"
    suggestion: "Consider wrapping in a safe abstraction"
}

// Rule for TODO/FIXME comments
rule todo-comments {
    name:        "TODO Comments"
    description: "Flags TODO and FIXME comments that should be resolved"
    severity:    info
    language:    any
    when {
        contains_pattern("(?i)todo") or contains_pattern("(?i)fixme")
    }
    message:    "Unresolved comment marker at line {line}: {snippet}"
    suggestion: "Resolve the TODO or FIXME before deployment"
}

// Rule with tags for categorization
rule gas-optimization {
    name:        "Gas Optimization Opportunity"
    description: "Detects patterns that could be optimized for gas efficiency"
    severity:    warning
    language:    solidity
    tags:        [gas, optimization, performance]
    when {
        contains_pattern("public") and contains_pattern("mapping")
    }
    message:    "Consider gas optimization at line {line}"
    suggestion: "Review if public visibility is necessary"
}

// Rule checking for missing require statements
rule missing-require {
    name:        "Missing Require Guard"
    description: "Detects functions without proper input validation"
    severity:    error
    language:    solidity
    when {
        not contains_pattern("require")
    }
    message:    "Function missing require() guard"
    suggestion: "Add input validation with require()"
}

// Rule for file complexity
rule complex-file {
    name:        "Complex File"
    description: "Flags files that exceed a reasonable line count"
    severity:    warning
    language:    any
    when {
        line_count_exceeds(500)
    }
    message:    "File has {snippet} lines (threshold: 500)"
    suggestion: "Consider splitting into smaller modules"
}

// Rule for nesting depth
rule deep-nesting {
    name:        "Deep Nesting"
    description: "Flags code with excessive nesting depth"
    severity:    warning
    language:    any
    when {
        nesting_depth_exceeds(5)
    }
    message:    "Nesting depth exceeds threshold at line {line}"
    suggestion: "Refactor to reduce nesting complexity"
}

// Rule for comment ratio
rule low-comment-ratio {
    name:        "Low Comment Ratio"
    description: "Flags files with insufficient documentation"
    severity:    info
    language:    any
    when {
        comment_ratio_below(0.1)
    }
    message:    "Comment ratio is {snippet} (threshold: 0.1)"
    suggestion: "Add more documentation to explain the code"
}

// Rule using keyword matching
rule loop-keyword {
    name:        "Loop Keyword Detected"
    description: "Detects usage of loop keyword"
    severity:    info
    language:    rust
    when {
        has_keyword("loop")
    }
    message:    "Loop keyword found at line {line}"
    suggestion: "Ensure loop has a clear exit condition"
}
