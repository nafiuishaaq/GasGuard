/**
 * Conflict Detector
 * 
 * Detects conflicting rule suggestions and provides resolution strategies
 */

import {
  ConflictInfo,
  ConflictType,
  ConflictSeverity,
  ConflictDetectionResult,
  ConflictDetectionConfig,
  ConflictRule,
  ResolutionStrategy,
} from './types';
import { RuleViolation, Suggestion } from '../context/context-aware-suggestions';

export class ConflictDetector {
  private conflictRules: Map<string, ConflictRule[]> = new Map();
  private config: ConflictDetectionConfig;

  constructor(config?: Partial<ConflictDetectionConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      minSeverity: config?.minSeverity ?? ConflictSeverity.LOW,
      customRules: config?.customRules ?? [],
    };
    this.initializeDefaultRules();
    this.loadCustomRules();
  }

  /**
   * Detect conflicts among a list of violations and suggestions
   */
  detectConflicts(
    violations: RuleViolation[],
    suggestions: Suggestion[]
  ): ConflictDetectionResult {
    if (!this.config.enabled) {
      return {
        hasConflicts: false,
        conflicts: [],
        conflictCounts: { low: 0, medium: 0, high: 0 },
      };
    }

    const conflicts: ConflictInfo[] = [];

    // Check for conflicts between all pairs of violations
    for (let i = 0; i < violations.length; i++) {
      for (let j = i + 1; j < violations.length; j++) {
        const conflict = this.checkPairConflict(
          violations[i],
          violations[j],
          suggestions[i],
          suggestions[j]
        );
        if (conflict && this.isSeverityAboveThreshold(conflict.severity)) {
          conflicts.push(conflict);
        }
      }
    }

    // Check for multi-finding conflicts
    conflicts.push(...this.checkMultiFindingConflicts(violations, suggestions));

    // Count conflicts by severity
    const conflictCounts = {
      low: conflicts.filter((c) => c.severity === ConflictSeverity.LOW).length,
      medium: conflicts.filter((c) => c.severity === ConflictSeverity.MEDIUM).length,
      high: conflicts.filter((c) => c.severity === ConflictSeverity.HIGH).length,
    };

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      conflictCounts,
    };
  }

  /**
   * Check if two violations conflict with each other
   */
  private checkPairConflict(
    violation1: RuleViolation,
    violation2: RuleViolation,
    suggestion1?: Suggestion,
    suggestion2?: Suggestion
  ): ConflictInfo | null {
    // Check for overlapping modifications at the same location
    if (this.isSameLocation(violation1, violation2)) {
      if (suggestion1 && suggestion2 && this.areSuggestionsConflicting(suggestion1, suggestion2)) {
        return {
          conflictType: ConflictType.OVERLAPPING_MODIFICATION,
          severity: ConflictSeverity.MEDIUM,
          description: `Conflicting suggestions at ${this.formatLocation(violation1)}`,
          involvedRules: [violation1.ruleId, violation2.ruleId],
          violations: [violation1, violation2],
          conflictingSuggestions: [suggestion1, suggestion2],
          location: violation1.location,
          resolutionSuggestion: this.getResolutionSuggestion(ConflictType.OVERLAPPING_MODIFICATION),
        };
      }
    }

    // Check for rule-specific conflicts
    const ruleConflict = this.checkRuleConflict(violation1.ruleId, violation2.ruleId);
    if (ruleConflict) {
      return {
        conflictType: ruleConflict.conflictType,
        severity: ruleConflict.severity,
        description: ruleConflict.description || `Rule conflict between ${violation1.ruleId} and ${violation2.ruleId}`,
        involvedRules: [violation1.ruleId, violation2.ruleId],
        violations: [violation1, violation2],
        conflictingSuggestions: suggestion1 && suggestion2 ? [suggestion1, suggestion2] : [],
        location: this.getCommonLocation(violation1, violation2),
        resolutionSuggestion: this.getResolutionSuggestion(ruleConflict.conflictType),
      };
    }

    // Check for opposite actions
    if (suggestion1 && suggestion2 && this.areOppositeActions(suggestion1, suggestion2)) {
      return {
        conflictType: ConflictType.OPPOSITE_ACTION,
        severity: ConflictSeverity.HIGH,
        description: `Opposite actions suggested: ${violation1.ruleId} vs ${violation2.ruleId}`,
        involvedRules: [violation1.ruleId, violation2.ruleId],
        violations: [violation1, violation2],
        conflictingSuggestions: [suggestion1, suggestion2],
        location: this.getCommonLocation(violation1, violation2),
        resolutionSuggestion: this.getResolutionSuggestion(ConflictType.OPPOSITE_ACTION),
      };
    }

    return null;
  }

  /**
   * Check for conflicts involving multiple findings
   */
  private checkMultiFindingConflicts(
    violations: RuleViolation[],
    suggestions: Suggestion[]
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Group violations by file
    const fileGroups = new Map<string, { violations: RuleViolation[]; suggestions: Suggestion[] }>();
    for (let i = 0; i < violations.length; i++) {
      const file = violations[i].location?.file || 'unknown';
      if (!fileGroups.has(file)) {
        fileGroups.set(file, { violations: [], suggestions: [] });
      }
      fileGroups.get(file)!.violations.push(violations[i]);
      fileGroups.get(file)!.suggestions.push(suggestions[i] || { ruleId: violations[i].ruleId, message: violations[i].message });
    }

    // Check for scope conflicts within each file
    for (const [file, group] of fileGroups) {
      conflicts.push(...this.checkScopeConflicts(group.violations, group.suggestions, file));
    }

    return conflicts;
  }

  /**
   * Check for scope-related conflicts (e.g., variable removal vs usage)
   */
  private checkScopeConflicts(
    violations: RuleViolation[],
    suggestions: Suggestion[],
    file: string
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Find removal suggestions
    const removalFindings: { violation: RuleViolation; suggestion: Suggestion }[] = [];
    const usageFindings: { violation: RuleViolation; suggestion: Suggestion }[] = [];

    for (let i = 0; i < violations.length; i++) {
      const suggestion = suggestions[i];
      if (this.isRemovalSuggestion(violations[i], suggestion)) {
        removalFindings.push({ violation: violations[i], suggestion });
      } else if (this.isUsageSuggestion(violations[i], suggestion)) {
        usageFindings.push({ violation: violations[i], suggestion });
      }
    }

    // Check for conflicts between removal and usage
    for (const removal of removalFindings) {
      for (const usage of usageFindings) {
        if (this.variableUsageConflicts(removal.violation, usage.violation)) {
          conflicts.push({
            conflictType: ConflictType.DEPENDENCY_VIOLATION,
            severity: ConflictSeverity.HIGH,
            description: `Variable removal conflicts with usage in ${file}`,
            involvedRules: [removal.violation.ruleId, usage.violation.ruleId],
            violations: [removal.violation, usage.violation],
            conflictingSuggestions: [removal.suggestion, usage.suggestion],
            location: removal.violation.location,
            resolutionSuggestion: this.getResolutionSuggestion(ConflictType.DEPENDENCY_VIOLATION),
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two violations are at the same location
   */
  private isSameLocation(v1: RuleViolation, v2: RuleViolation): boolean {
    return (
      v1.location?.file === v2.location?.file &&
      v1.location?.line === v2.location?.line &&
      v1.location?.column === v2.location?.column
    );
  }

  /**
   * Check if two suggestions conflict with each other
   */
  private areSuggestionsConflicting(s1: Suggestion, s2: Suggestion): boolean {
    // Different suggestions that both modify code
    if (s1.message !== s2.message) {
      const modifies1 = this.isModificationSuggestion(s1);
      const modifies2 = this.isModificationSuggestion(s2);
      return modifies1 && modifies2;
    }
    return false;
  }

  /**
   * Check if suggestions suggest opposite actions
   */
  private areOppositeActions(s1: Suggestion, s2: Suggestion): boolean {
    const opposites = [
      ['add', 'remove'],
      ['include', 'exclude'],
      ['enable', 'disable'],
      ['use', 'avoid'],
      ['cache', 'bypass'],
    ];

    const msg1 = s1.message.toLowerCase();
    const msg2 = s2.message.toLowerCase();

    for (const [op1, op2] of opposites) {
      if (msg1.includes(op1) && msg2.includes(op2)) {
        return true;
      }
      if (msg1.includes(op2) && msg2.includes(op1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a suggestion is a modification suggestion
   */
  private isModificationSuggestion(s: Suggestion): boolean {
    const keywords = ['remove', 'replace', 'change', 'modify', 'delete', 'add'];
    return keywords.some((kw) => s.message.toLowerCase().includes(kw));
  }

  /**
   * Check if a violation/suggestion is about removal
   */
  private isRemovalSuggestion(v: RuleViolation, s?: Suggestion): boolean {
    const msg = (s?.message || v.message).toLowerCase();
    return msg.includes('remove') || msg.includes('delete') || msg.includes('unused');
  }

  /**
   * Check if a violation/suggestion is about usage
   */
  private isUsageSuggestion(v: RuleViolation, s?: Suggestion): boolean {
    const msg = (s?.message || v.message).toLowerCase();
    return msg.includes('use') || msg.includes('access') || msg.includes('reference');
  }

  /**
   * Check if variable removal conflicts with usage
   */
  private variableUsageConflicts(removal: RuleViolation, usage: RuleViolation): boolean {
    if (removal.location?.file !== usage.location?.file) {
      return false;
    }
    const lineDiff = Math.abs((removal.location?.line || 0) - (usage.location?.line || 0));
    return lineDiff < 10; // Within 10 lines
  }

  /**
   * Check if two rules have a defined conflict
   */
  private checkRuleConflict(ruleId1: string, ruleId2: string): ConflictRule | null {
    for (const [pattern, rules] of this.conflictRules) {
      if (this.matchesPattern(ruleId1, pattern)) {
        for (const rule of rules) {
          if (this.matchesPattern(ruleId2, rule.rulePattern2)) {
            return rule;
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if a rule ID matches a pattern (supports wildcards)
   */
  private matchesPattern(ruleId: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(ruleId);
    }
    return ruleId === pattern;
  }

  /**
   * Get common location between two violations
   */
  private getCommonLocation(v1: RuleViolation, v2: RuleViolation): { file?: string; line?: number } | undefined {
    if (v1.location?.file === v2.location?.file) {
      return {
        file: v1.location?.file,
        line: v1.location?.line,
      };
    }
    return undefined;
  }

  /**
   * Format location for display
   */
  private formatLocation(v: RuleViolation): string {
    if (!v.location) return 'unknown location';
    return `${v.location.file}:${v.location.line}${v.location.column ? `:${v.location.column}` : ''}`;
  }

  /**
   * Check if severity is above the configured threshold
   */
  private isSeverityAboveThreshold(severity: ConflictSeverity): boolean {
    const order = [ConflictSeverity.LOW, ConflictSeverity.MEDIUM, ConflictSeverity.HIGH];
    const thresholdIndex = order.indexOf(this.config.minSeverity);
    const severityIndex = order.indexOf(severity);
    return severityIndex >= thresholdIndex;
  }

  /**
   * Get resolution suggestion for a conflict type
   */
  private getResolutionSuggestion(conflictType: ConflictType): string {
    switch (conflictType) {
      case ConflictType.OVERLAPPING_MODIFICATION:
        return 'Consider applying only one of the conflicting optimizations or merge manually.';
      case ConflictType.CONTRADICTORY_OPTIMIZATION:
        return 'These optimizations contradict each other. Choose the one with higher impact.';
      case ConflictType.DEPENDENCY_VIOLATION:
        return 'One optimization depends on code that another wants to remove. Review dependencies.';
      case ConflictType.SCOPE_CONFLICT:
        return 'Scope-related conflict. Check if optimizations affect the same variable/function scope.';
      case ConflictType.OPPOSITE_ACTION:
        return 'Rules suggest opposite actions. Review which action is appropriate for your use case.';
    }
  }

  /**
   * Initialize default conflict rules
   */
  private initializeDefaultRules(): void {
    // Gas optimization conflicts
    this.addConflictRule({
      rulePattern1: 'gas-*',
      rulePattern2: 'gas-*',
      conflictType: ConflictType.CONTRADICTORY_OPTIMIZATION,
      severity: ConflictSeverity.MEDIUM,
      resolutionStrategy: ResolutionStrategy.REQUIRE_USER_INPUT,
      description: 'Multiple gas optimizations may conflict',
    });

    // Security vs optimization conflicts
    this.addConflictRule({
      rulePattern1: 'security-*',
      rulePattern2: 'gas-*',
      conflictType: ConflictType.CONTRADICTORY_OPTIMIZATION,
      severity: ConflictSeverity.HIGH,
      resolutionStrategy: ResolutionStrategy.PREFER_FIRST,
      description: 'Security rules take precedence over gas optimizations',
    });

    // Unused variable conflicts
    this.addConflictRule({
      rulePattern1: '*unused*',
      rulePattern2: '*usage*',
      conflictType: ConflictType.DEPENDENCY_VIOLATION,
      severity: ConflictSeverity.HIGH,
      resolutionStrategy: ResolutionStrategy.REQUIRE_USER_INPUT,
      description: 'Variable removal may conflict with usage',
    });
  }

  /**
   * Load custom conflict rules from config
   */
  private loadCustomRules(): void {
    if (this.config.customRules) {
      for (const rule of this.config.customRules) {
        this.addConflictRule(rule);
      }
    }
  }

  /**
   * Add a conflict rule
   */
  private addConflictRule(rule: ConflictRule): void {
    const pattern = rule.rulePattern1;
    if (!this.conflictRules.has(pattern)) {
      this.conflictRules.set(pattern, []);
    }
    this.conflictRules.get(pattern)!.push(rule);
  }

  /**
   * Get resolution strategy for a conflict
   */
  public getResolutionStrategy(conflict: ConflictInfo): ResolutionStrategy {
    const ruleConflict = this.checkRuleConflict(conflict.involvedRules[0], conflict.involvedRules[1]);
    return ruleConflict?.resolutionStrategy || ResolutionStrategy.REQUIRE_USER_INPUT;
  }
}
