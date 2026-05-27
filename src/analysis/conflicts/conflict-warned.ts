/**
 * Conflict Warning System
 * 
 * Provides user-facing warnings for detected conflicts
 */

import {
  ConflictInfo,
  ConflictDetectionResult,
  ConflictSeverity,
} from './types';

export interface WarningOutput {
  /** Formatted warning message */
  message: string;
  /** Severity level for display */
  severity: ConflictSeverity;
  /** Whether this is a critical warning that requires attention */
  critical: boolean;
  /** Suggested actions */
  actions: string[];
}

export class ConflictWarner {
  /**
   * Generate user-friendly warnings from conflict detection results
   */
  generateWarnings(result: ConflictDetectionResult): WarningOutput[] {
    if (!result.hasConflicts) {
      return [];
    }

    const warnings: WarningOutput[] = [];

    // Group conflicts by severity
    const highSeverityConflicts = result.conflicts.filter(
      (c) => c.severity === ConflictSeverity.HIGH
    );
    const mediumSeverityConflicts = result.conflicts.filter(
      (c) => c.severity === ConflictSeverity.MEDIUM
    );
    const lowSeverityConflicts = result.conflicts.filter(
      (c) => c.severity === ConflictSeverity.LOW
    );

    // Generate summary warning
    warnings.push(this.generateSummaryWarning(result));

    // Generate individual conflict warnings
    for (const conflict of highSeverityConflicts) {
      warnings.push(this.generateConflictWarning(conflict, true));
    }

    for (const conflict of mediumSeverityConflicts) {
      warnings.push(this.generateConflictWarning(conflict, false));
    }

    // Low severity conflicts only shown in verbose mode
    for (const conflict of lowSeverityConflicts) {
      warnings.push(this.generateConflictWarning(conflict, false));
    }

    return warnings;
  }

  /**
   * Generate a summary warning for all conflicts
   */
  private generateSummaryWarning(result: ConflictDetectionResult): WarningOutput {
    const { conflicts, conflictCounts } = result;
    const total = conflicts.length;

    let message = `⚠️  Detected ${total} conflict${total > 1 ? 's' : ''} between rule suggestions.`;
    
    if (conflictCounts.high > 0) {
      message += ` ${conflictCounts.high} critical,`;
    }
    if (conflictCounts.medium > 0) {
      message += ` ${conflictCounts.medium} medium,`;
    }
    if (conflictCounts.low > 0) {
      message += ` ${conflictCounts.low} low`;
    }

    message = message.replace(/,\s*$/, '.');
    message += ' Review conflicts before applying fixes.';

    const actions: string[] = [];
    if (conflictCounts.high > 0) {
      actions.push('Review critical conflicts immediately');
    }
    if (conflictCounts.medium > 0) {
      actions.push('Choose between conflicting optimizations');
    }
    actions.push('Consider applying fixes selectively');

    return {
      message,
      severity: conflictCounts.high > 0 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
      critical: conflictCounts.high > 0,
      actions,
    };
  }

  /**
   * Generate a warning for a specific conflict
   */
  private generateConflictWarning(conflict: ConflictInfo, critical: boolean): WarningOutput {
    const location = conflict.location
      ? `${conflict.location.file}:${conflict.location.line}`
      : 'multiple locations';
    
    const rules = conflict.involvedRules.join(' vs ');
    
    let message = `${critical ? '🚨' : '⚠️'}  Conflict: ${conflict.description}`;
    message += `\n   Rules: ${rules}`;
    if (location !== 'multiple locations') {
      message += `\n   Location: ${location}`;
    }
    if (conflict.resolutionSuggestion) {
      message += `\n   Suggestion: ${conflict.resolutionSuggestion}`;
    }

    const actions: string[] = [];
    switch (conflict.conflictType) {
      case 'OVERLAPPING_MODIFICATION':
        actions.push('Apply only one suggestion');
        actions.push('Or merge manually if compatible');
        break;
      case 'CONTRADICTORY_OPTIMIZATION':
        actions.push('Choose the higher-impact optimization');
        actions.push('Or disable one of the conflicting rules');
        break;
      case 'DEPENDENCY_VIOLATION':
        actions.push('Review code dependencies');
        actions.push('Keep the required code');
        break;
      case 'SCOPE_CONFLICT':
        actions.push('Check variable/function scopes');
        actions.push('Ensure changes are isolated');
        break;
      case 'OPPOSITE_ACTION':
        actions.push('Determine which action is appropriate');
        actions.push('Review the context of each suggestion');
        break;
    }

    return {
      message,
      severity: conflict.severity,
      critical,
      actions,
    };
  }

  /**
   * Print warnings to console in a formatted way
   */
  printWarnings(result: ConflictDetectionResult): void {
    const warnings = this.generateWarnings(result);

    if (warnings.length === 0) {
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('CONFLICT DETECTION REPORT');
    console.log('='.repeat(80) + '\n');

    for (const warning of warnings) {
      const icon = warning.critical ? '🚨' : '⚠️';
      const severity = warning.severity.toUpperCase();
      
      console.log(`${icon} [${severity}] ${warning.message}\n`);
      
      if (warning.actions.length > 0) {
        console.log('   Suggested actions:');
        for (const action of warning.actions) {
          console.log(`   • ${action}`);
        }
        console.log();
      }
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Generate a machine-readable warning format (e.g., for JSON output)
   */
  generateStructuredWarnings(result: ConflictDetectionResult): {
    summary: string;
    conflicts: Array<{
      type: string;
      severity: string;
      description: string;
      rules: string[];
      location?: string;
      resolution: string;
    }>;
  } {
    return {
      summary: `Detected ${result.conflicts.length} conflicts`,
      conflicts: result.conflicts.map((conflict) => ({
        type: conflict.conflictType,
        severity: conflict.severity,
        description: conflict.description,
        rules: conflict.involvedRules,
        location: conflict.location
          ? `${conflict.location.file}:${conflict.location.line}`
          : undefined,
        resolution: conflict.resolutionSuggestion || 'No resolution suggested',
      })),
    };
  }

  /**
   * Check if conflicts should block execution
   */
  shouldBlockExecution(result: ConflictDetectionResult): boolean {
    return result.conflictCounts.high > 0;
  }

  /**
   * Get a quick status message
   */
  getStatusMessage(result: ConflictDetectionResult): string {
    if (!result.hasConflicts) {
      return '✅ No conflicts detected';
    }

    if (result.conflictCounts.high > 0) {
      return `🚨 ${result.conflictCounts.high} critical conflict(s) detected`;
    }

    if (result.conflictCounts.medium > 0) {
      return `⚠️  ${result.conflictCounts.medium} conflict(s) detected`;
    }

    return `ℹ️  ${result.conflictCounts.low} minor conflict(s) detected`;
  }
}
