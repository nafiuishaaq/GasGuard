/**
 * Conflict Detection Types
 * 
 * Defines the data structures for detecting and reporting conflicting rule suggestions
 */

import { RuleViolation, Suggestion } from '../context/context-aware-suggestions';

/** Types of conflicts that can occur between rule suggestions */
export enum ConflictType {
  /** Two rules suggest different modifications to the same code location */
  OVERLAPPING_MODIFICATION = 'OVERLAPPING_MODIFICATION',
  /** Rules suggest contradictory optimizations (e.g., cache vs remove) */
  CONTRADICTORY_OPTIMIZATION = 'CONTRADICTORY_OPTIMIZATION',
  /** One rule depends on code another rule wants to remove */
  DEPENDENCY_VIOLATION = 'DEPENDENCY_VIOLATION',
  /** Rules affect the same variable/function scope in conflicting ways */
  SCOPE_CONFLICT = 'SCOPE_CONFLICT',
  /** Rules suggest opposite actions (e.g., add vs remove) */
  OPPOSITE_ACTION = 'OPPOSITE_ACTION',
}

/** Severity level of the conflict */
export enum ConflictSeverity {
  /** Can be resolved automatically or safely ignored */
  LOW = 'LOW',
  /** Requires user choice between alternatives */
  MEDIUM = 'MEDIUM',
  /** Should not be merged - critical conflict */
  HIGH = 'HIGH',
}

/** Information about a detected conflict */
export interface ConflictInfo {
  /** Type of conflict detected */
  conflictType: ConflictType;
  /** Severity of the conflict */
  severity: ConflictSeverity;
  /** Human-readable description of the conflict */
  description: string;
  /** Rule IDs involved in the conflict */
  involvedRules: string[];
  /** Violations involved in the conflict */
  violations: RuleViolation[];
  /** Suggestions that conflict with each other */
  conflictingSuggestions: Suggestion[];
  /** Location of the conflict (if applicable) */
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  /** Suggested resolution for the conflict */
  resolutionSuggestion?: string;
}

/** Result of conflict detection */
export interface ConflictDetectionResult {
  /** Whether any conflicts were detected */
  hasConflicts: boolean;
  /** List of all detected conflicts */
  conflicts: ConflictInfo[];
  /** Total number of conflicts by severity */
  conflictCounts: {
    low: number;
    medium: number;
    high: number;
  };
}

/** Configuration for conflict detection */
export interface ConflictDetectionConfig {
  /** Whether to enable conflict detection */
  enabled: boolean;
  /** Minimum severity level to report */
  minSeverity: ConflictSeverity;
  /** Custom conflict rules */
  customRules?: ConflictRule[];
}

/** Rule defining when two specific rules conflict */
export interface ConflictRule {
  /** Pattern for the first rule ID (can use wildcards) */
  rulePattern1: string;
  /** Pattern for the second rule ID (can use wildcards) */
  rulePattern2: string;
  /** Type of conflict that occurs */
  conflictType: ConflictType;
  /** Severity of the conflict */
  severity: ConflictSeverity;
  /** Custom description (optional) */
  description?: string;
  /** Resolution strategy */
  resolutionStrategy: ResolutionStrategy;
}

/** Strategy for resolving conflicts */
export enum ResolutionStrategy {
  /** Prefer the first rule's suggestion */
  PREFER_FIRST = 'PREFER_FIRST',
  /** Prefer the second rule's suggestion */
  PREFER_SECOND = 'PREFER_SECOND',
  /** Try to merge if compatible */
  MERGE_IF_COMPATIBLE = 'MERGE_IF_COMPATIBLE',
  /** Require user input to resolve */
  REQUIRE_USER_INPUT = 'REQUIRE_USER_INPUT',
  /** Apply both if they don't conflict */
  APPLY_BOTH = 'APPLY_BOTH',
}
