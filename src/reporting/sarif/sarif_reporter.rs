use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use analysis_core::plugin::Finding;

/// SARIF Log Format - Root structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifLog {
    pub version: String,
    #[serde(rename = "$schema")]
    pub schema: String,
    pub runs: Vec<SarifRun>,
}

/// SARIF Run - Represents a single tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifRun {
    pub tool: SarifTool,
    pub results: Vec<SarifResult>,
    pub invocations: Option<Vec<SarifInvocation>>,
}

/// SARIF Tool - Information about the analysis tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifTool {
    pub driver: SarifToolComponent,
}

/// SARIF Tool Component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifToolComponent {
    pub name: String,
    pub version: String,
    #[serde(rename = "informationUri")]
    pub information_uri: Option<String>,
    #[serde(rename = "rules")]
    pub rules: Vec<SarifRule>,
}

/// SARIF Rule - Represents a rule/check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifRule {
    pub id: String,
    #[serde(rename = "shortDescription")]
    pub short_description: SarifMessage,
    #[serde(rename = "fullDescription")]
    pub full_description: Option<SarifMessage>,
    pub help: Option<SarifMessage>,
    pub properties: Option<SarifRuleProperties>,
}

/// SARIF Rule Properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifRuleProperties {
    #[serde(rename = "category")]
    pub category: String,
    pub precision: String,
    #[serde(rename = "security-severity")]
    pub security_severity: Option<String>,
}

/// SARIF Message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifMessage {
    pub text: String,
}

/// SARIF Result - Represents a single finding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifResult {
    #[serde(rename = "ruleId")]
    pub rule_id: String,
    pub level: String,
    pub message: SarifMessage,
    pub locations: Vec<SarifLocation>,
    pub fixes: Option<Vec<SarifFix>>,
}

/// SARIF Location - Where the issue was found
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifLocation {
    pub physical_location: SarifPhysicalLocation,
}

/// SARIF Physical Location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifPhysicalLocation {
    #[serde(rename = "artifactLocation")]
    pub artifact_location: SarifArtifactLocation,
    pub region: SarifRegion,
}

/// SARIF Artifact Location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifArtifactLocation {
    #[serde(rename = "uri")]
    pub uri: String,
}

/// SARIF Region - Line/column information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifRegion {
    #[serde(rename = "startLine")]
    pub start_line: u32,
    #[serde(rename = "startColumn")]
    pub start_column: Option<u32>,
    #[serde(rename = "endLine")]
    pub end_line: Option<u32>,
    #[serde(rename = "endColumn")]
    pub end_column: Option<u32>,
}

/// SARIF Fix - Suggested fix
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifFix {
    pub description: SarifMessage,
    pub artifact_changes: Vec<SarifArtifactChange>,
}

/// SARIF Artifact Change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifArtifactChange {
    #[serde(rename = "artifactLocation")]
    pub artifact_location: SarifArtifactLocation,
    pub replacements: Vec<SarifReplacement>,
}

/// SARIF Replacement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifReplacement {
    pub region: SarifRegion,
    #[serde(rename = "insertedContent")]
    pub inserted_content: Option<SarifInsertedContent>,
}

/// SARIF Inserted Content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifInsertedContent {
    pub text: String,
}

/// SARIF Invocation - Tool invocation details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SarifInvocation {
    #[serde(rename = "startTimeUtc")]
    pub start_time_utc: String,
    #[serde(rename = "endTimeUtc")]
    pub end_time_utc: String,
    #[serde(rename = "executionSuccessful")]
    pub execution_successful: bool,
}

pub struct SarifReporter;

impl SarifReporter {
    pub fn new() -> Self {
        Self
    }

    /// Generate SARIF report from findings
    pub fn generate_report<P: AsRef<Path>>(
        &self,
        findings: &[Finding],
        scan_path: &str,
        output_path: P,
    ) -> Result<(), String> {
        let log = self.create_sarif_log(findings, scan_path);
        
        let json = serde_json::to_string_pretty(&log)
            .map_err(|e| format!("Failed to serialize SARIF report: {}", e))?;
        
        fs::write(output_path, json)
            .map_err(|e| format!("Failed to write SARIF report: {}", e))?;
        
        Ok(())
    }

    /// Create SARIF log structure from findings
    pub fn create_sarif_log(&self, findings: &[Finding], scan_path: &str) -> SarifLog {
        let rules = self.extract_rules(findings);
        let results = findings.iter()
            .map(|f| self.convert_finding(f))
            .collect();

        let start_time = chrono::Utc::now();
        let end_time = start_time + chrono::Duration::seconds(1); // Simplified timing

        SarifLog {
            version: "2.1.0".to_string(),
            schema: "https://json.schemastore.org/sarif-2.1.0.json".to_string(),
            runs: vec![
                SarifRun {
                    tool: SarifTool {
                        driver: SarifToolComponent {
                            name: "GasGuard".to_string(),
                            version: env!("CARGO_PKG_VERSION").to_string(),
                            information_uri: Some("https://github.com/Nabeelahh/GasGuard".to_string()),
                            rules,
                        },
                    },
                    results,
                    invocations: Some(vec![
                        SarifInvocation {
                            start_time_utc: start_time.to_rfc3339(),
                            end_time_utc: end_time.to_rfc3339(),
                            execution_successful: true,
                        },
                    ]),
                },
            ],
        }
    }

    /// Extract unique rules from findings
    fn extract_rules(&self, findings: &[Finding]) -> Vec<SarifRule> {
        let mut rules_map = std::collections::HashMap::new();
        
        for finding in findings {
            if !rules_map.contains_key(&finding.rule_id) {
                let category = self.categorize_rule(&finding.rule_id);
                let severity = self.severity_to_security_level(&finding.severity);
                
                rules_map.insert(
                    finding.rule_id.clone(),
                    SarifRule {
                        id: finding.rule_id.clone(),
                        short_description: SarifMessage {
                            text: self.get_rule_short_description(&finding.rule_id),
                        },
                        full_description: Some(SarifMessage {
                            text: self.get_rule_full_description(&finding.rule_id),
                        }),
                        help: Some(SarifMessage {
                            text: finding.message.clone(),
                        }),
                        properties: Some(SarifRuleProperties {
                            category,
                            precision: "medium".to_string(),
                            security_severity: Some(severity),
                        }),
                    },
                );
            }
        }
        
        rules_map.into_values().collect()
    }

    /// Convert a single finding to SARIF result
    fn convert_finding(&self, finding: &Finding) -> SarifResult {
        let level = self.severity_to_level(&finding.severity);
        let fixes = finding.suggestion.as_ref().map(|suggestion| {
            vec![SarifFix {
                description: SarifMessage {
                    text: "Suggested fix".to_string(),
                },
                artifact_changes: vec![SarifArtifactChange {
                    artifact_location: SarifArtifactLocation {
                        uri: finding.file.clone(),
                    },
                    replacements: vec![SarifReplacement {
                        region: SarifRegion {
                            start_line: finding.line,
                            start_column: finding.column,
                            end_line: Some(finding.line),
                            end_column: finding.column,
                        },
                        inserted_content: Some(SarifInsertedContent {
                            text: suggestion.clone(),
                        }),
                    }],
                }],
            }]
        });

        SarifResult {
            rule_id: finding.rule_id.clone(),
            level,
            message: SarifMessage {
                text: finding.message.clone(),
            },
            locations: vec![SarifLocation {
                physical_location: SarifPhysicalLocation {
                    artifact_location: SarifArtifactLocation {
                        uri: finding.file.clone(),
                    },
                    region: SarifRegion {
                        start_line: finding.line,
                        start_column: finding.column,
                        end_line: Some(finding.line),
                        end_column: finding.column,
                    },
                },
            }],
            fixes,
        }
    }

    /// Convert severity to SARIF level
    fn severity_to_level(&self, severity: &analysis_core::plugin::Severity) -> String {
        match severity {
            analysis_core::plugin::Severity::Critical => "error".to_string(),
            analysis_core::plugin::Severity::Error => "error".to_string(),
            analysis_core::plugin::Severity::Warning => "warning".to_string(),
            analysis_core::plugin::Severity::Info => "note".to_string(),
        }
    }

    /// Convert severity to security severity level (CVSS-like)
    fn severity_to_security_level(&self, severity: &analysis_core::plugin::Severity) -> String {
        match severity {
            analysis_core::plugin::Severity::Critical => "9.0".to_string(),
            analysis_core::plugin::Severity::Error => "7.0".to_string(),
            analysis_core::plugin::Severity::Warning => "4.0".to_string(),
            analysis_core::plugin::Severity::Info => "0.0".to_string(),
        }
    }

    /// Categorize rule based on ID prefix
    fn categorize_rule(&self, rule_id: &str) -> String {
        if rule_id.starts_with("SOL-") {
            "solidity".to_string()
        } else if rule_id.starts_with("VY-") {
            "vyper".to_string()
        } else if rule_id.starts_with("RS-") {
            "rust".to_string()
        } else if rule_id.starts_with("SOR-") {
            "soroban".to_string()
        } else {
            "general".to_string()
        }
    }

    /// Get short description for a rule
    fn get_rule_short_description(&self, rule_id: &str) -> String {
        match rule_id {
            "SOL-001" => "Use bytes32 instead of string for fixed-length data".to_string(),
            "SOL-002" => "Use uint256 instead of uint".to_string(),
            "SOL-003" => "Use calldata instead of memory for read-only arguments".to_string(),
            _ => format!("Gas optimization rule {}", rule_id),
        }
    }

    /// Get full description for a rule
    fn get_rule_full_description(&self, rule_id: &str) -> String {
        match rule_id {
            "SOL-001" => "Using bytes32 instead of string for fixed-length data can save gas".to_string(),
            "SOL-002" => "Using uint256 instead of uint can save gas by avoiding type conversion".to_string(),
            "SOL-003" => "Using calldata instead of memory for read-only arguments can save gas".to_string(),
            _ => format!("Gas optimization rule: {}", rule_id),
        }
    }
}

impl Default for SarifReporter {
    fn default() -> Self {
        Self::new()
    }
}
