# SARIF Reporter

This module provides SARIF (Static Analysis Results Interchange Format) export functionality for GasGuard analysis results.

## Overview

SARIF is a standard format for static analysis tools that enables better integration with security tools, CI/CD systems, and other development tools.

## Usage

### TypeScript (CLI)

```typescript
import { generateSarifReport } from './reporting/sarif-reporter';

const results = {
  timestamp: new Date().toISOString(),
  scanPath: '/path/to/scan',
  totalFiles: 10,
  scannedFiles: 10,
  findings: [...],
  summary: {...}
};

await generateSarifReport(results, 'output.sarif.json');
```

### Rust

```rust
use reporting::sarif::SarifReporter;
use analysis_core::plugin::Finding;

let reporter = SarifReporter::new();
let findings = vec![...];

reporter.generate_report(&findings, "/scan/path", "output.sarif.json")?;
```

## CLI Usage

```bash
# Generate SARIF report
gasguard scan . -f sarif -o report.sarif.json

# Generate both JSON and SARIF
gasguard scan . -f both -o report.json
```

## SARIF Format

The generated SARIF files follow the SARIF 2.1.0 specification and include:

- **Tool Information**: GasGuard version and metadata
- **Rules**: All rules used in the analysis with descriptions
- **Results**: Individual findings with locations, severity, and suggested fixes
- **Invocations**: Tool execution timing information

## Features

- **Severity Mapping**: Converts GasGuard severity levels to SARIF levels
  - Critical/Error → error
  - Warning → warning
  - Info → note

- **Rule Categorization**: Automatically categorizes rules by language
  - SOL-* → solidity
  - VY-* → vyper
  - RS-* → rust
  - SOR-* → soroban

- **Fix Suggestions**: Includes suggested fixes when available

- **Security Severity**: Maps severity to CVSS-like scores for security tools

## Compatibility

The SARIF output is compatible with:
- GitHub Advanced Security
- Azure DevOps
- SonarQube
- Other SARIF-compatible tools

## Testing

Run the tests:

```bash
# Rust tests
cargo test sarif_reporter

# TypeScript tests
npm test -- sarif-reporter.spec.ts
```
