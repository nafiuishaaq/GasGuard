#[cfg(test)]
mod tests {
    use super::*;
    use analysis_core::plugin::{Finding, Severity};
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_create_sarif_log() {
        let reporter = SarifReporter::new();
        let findings = vec![
            Finding {
                rule_id: "SOL-001".to_string(),
                severity: Severity::Error,
                message: "Use bytes32 instead of string for fixed-length data".to_string(),
                file: "/test/path/contract.sol".to_string(),
                line: 10,
                column: None,
                suggestion: Some("Replace string with bytes32 to save gas".to_string()),
            },
        ];

        let log = reporter.create_sarif_log(&findings, "/test/path");

        assert_eq!(log.version, "2.1.0");
        assert_eq!(log.schema, "https://json.schemastore.org/sarif-2.1.0.json");
        assert_eq!(log.runs.len(), 1);
        assert_eq!(log.runs[0].tool.driver.name, "GasGuard");
        assert_eq!(log.runs[0].results.len(), 1);
    }

    #[test]
    fn test_convert_finding() {
        let reporter = SarifReporter::new();
        let finding = Finding {
            rule_id: "SOL-001".to_string(),
            severity: Severity::Error,
            message: "Test message".to_string(),
            file: "/test/path/contract.sol".to_string(),
            line: 10,
            column: Some(5),
            suggestion: Some("Fix suggestion".to_string()),
        };

        let result = reporter.convert_finding(&finding);

        assert_eq!(result.rule_id, "SOL-001");
        assert_eq!(result.level, "error");
        assert_eq!(result.message.text, "Test message");
        assert_eq!(result.locations.len(), 1);
        assert_eq!(result.locations[0].physical_location.artifact_location.uri, "/test/path/contract.sol");
        assert_eq!(result.locations[0].physical_location.region.start_line, 10);
        assert!(result.fixes.is_some());
    }

    #[test]
    fn test_severity_to_level() {
        let reporter = SarifReporter::new();

        assert_eq!(reporter.severity_to_level(&Severity::Critical), "error");
        assert_eq!(reporter.severity_to_level(&Severity::Error), "error");
        assert_eq!(reporter.severity_to_level(&Severity::Warning), "warning");
        assert_eq!(reporter.severity_to_level(&Severity::Info), "note");
    }

    #[test]
    fn test_categorize_rule() {
        let reporter = SarifReporter::new();

        assert_eq!(reporter.categorize_rule("SOL-001"), "solidity");
        assert_eq!(reporter.categorize_rule("VY-001"), "vyper");
        assert_eq!(reporter.categorize_rule("RS-001"), "rust");
        assert_eq!(reporter.categorize_rule("SOR-001"), "soroban");
        assert_eq!(reporter.categorize_rule("GEN-001"), "general");
    }

    #[test]
    fn test_generate_report() {
        let reporter = SarifReporter::new();
        let findings = vec![
            Finding {
                rule_id: "SOL-001".to_string(),
                severity: Severity::Error,
                message: "Test message".to_string(),
                file: "/test/path/contract.sol".to_string(),
                line: 10,
                column: None,
                suggestion: None,
            },
        ];

        let dir = tempdir().unwrap();
        let output_path = dir.path().join("test.sarif.json");

        let result = reporter.generate_report(&findings, "/test/path", &output_path);
        assert!(result.is_ok());

        // Verify file was created
        assert!(output_path.exists());

        // Verify content is valid JSON
        let content = fs::read_to_string(&output_path).unwrap();
        let _: serde_json::Value = serde_json::from_str(&content).unwrap();
    }

    #[test]
    fn test_empty_findings() {
        let reporter = SarifReporter::new();
        let findings: Vec<Finding> = vec![];

        let log = reporter.create_sarif_log(&findings, "/test/path");

        assert_eq!(log.runs[0].results.len(), 0);
        assert_eq!(log.runs[0].tool.driver.rules.len(), 0);
    }
}
