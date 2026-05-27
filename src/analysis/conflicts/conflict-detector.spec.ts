/**
 * Conflict Detector Tests
 */

import { ConflictDetector, ConflictWarner } from './index';
import { ConflictType, ConflictSeverity, ConflictRule, ResolutionStrategy } from './types';
import { RuleViolation } from '../pipeline/types';
import { Suggestion } from '../context/context-aware-suggestions';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts when violations are unrelated', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'rule-1',
          type: 'gas',
          severity: 'medium',
          message: 'Use uint256 instead of uint8',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'rule-2',
          type: 'security',
          severity: 'high',
          message: 'Add access control',
          location: { file: 'contract.sol', line: 20 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'rule-1', message: 'Replace uint8 with uint256' },
        { ruleId: 'rule-2', message: 'Add onlyOwner modifier' },
      ];

      const result = detector.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect overlapping modifications at same location', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'rule-1',
          type: 'gas',
          severity: 'medium',
          message: 'Remove unused variable',
          location: { file: 'contract.sol', line: 10, column: 5 },
        },
        {
          ruleId: 'rule-2',
          type: 'gas',
          severity: 'medium',
          message: 'Replace variable with constant',
          location: { file: 'contract.sol', line: 10, column: 5 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'rule-1', message: 'Remove the variable x' },
        { ruleId: 'rule-2', message: 'Replace x with constant' },
      ];

      const result = detector.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe(ConflictType.OVERLAPPING_MODIFICATION);
      expect(result.conflicts[0].involvedRules).toEqual(['rule-1', 'rule-2']);
    });

    it('should detect opposite actions', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'rule-1',
          type: 'gas',
          severity: 'medium',
          message: 'Add caching',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'rule-2',
          type: 'gas',
          severity: 'medium',
          message: 'Remove caching',
          location: { file: 'contract.sol', line: 10 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'rule-1', message: 'Add caching for this variable' },
        { ruleId: 'rule-2', message: 'Remove caching to save gas' },
      ];

      const result = detector.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].conflictType).toBe(ConflictType.OPPOSITE_ACTION);
    });

    it('should detect rule-specific conflicts', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'gas-001',
          type: 'gas',
          severity: 'medium',
          message: 'Optimize loop',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'gas-002',
          type: 'gas',
          severity: 'medium',
          message: 'Different optimization',
          location: { file: 'contract.sol', line: 20 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'gas-001', message: 'Cache loop variable' },
        { ruleId: 'gas-002', message: 'Unroll loop' },
      ];

      const result = detector.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].conflictType).toBe(ConflictType.CONTRADICTORY_OPTIMIZATION);
    });

    it('should detect dependency violations (removal vs usage)', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'unused-001',
          type: 'cleanup',
          severity: 'low',
          message: 'Remove unused variable x',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'usage-001',
          type: 'optimization',
          severity: 'medium',
          message: 'Use variable x for caching',
          location: { file: 'contract.sol', line: 15 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'unused-001', message: 'Remove unused variable x' },
        { ruleId: 'usage-001', message: 'Use variable x' },
      ];

      const result = detector.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].conflictType).toBe(ConflictType.DEPENDENCY_VIOLATION);
      expect(result.conflicts[0].severity).toBe(ConflictSeverity.HIGH);
    });

    it('should respect severity threshold', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'rule-1',
          type: 'gas',
          severity: 'medium',
          message: 'Optimization 1',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'rule-2',
          type: 'gas',
          severity: 'medium',
          message: 'Optimization 2',
          location: { file: 'contract.sol', line: 10 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'rule-1', message: 'Remove x' },
        { ruleId: 'rule-2', message: 'Replace x' },
      ];

      const detectorHighThreshold = new ConflictDetector({ minSeverity: ConflictSeverity.HIGH });
      const result = detectorHighThreshold.detectConflicts(violations, suggestions);

      // Medium severity conflict should be filtered out
      expect(result.hasConflicts).toBe(false);
    });

    it('should be disabled when config.enabled is false', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'rule-1',
          type: 'gas',
          severity: 'medium',
          message: 'Optimization 1',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'rule-2',
          type: 'gas',
          severity: 'medium',
          message: 'Optimization 2',
          location: { file: 'contract.sol', line: 10 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'rule-1', message: 'Remove x' },
        { ruleId: 'rule-2', message: 'Replace x' },
      ];

      const disabledDetector = new ConflictDetector({ enabled: false });
      const result = disabledDetector.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(false);
    });

    it('should use custom conflict rules', () => {
      const customRule: ConflictRule = {
        rulePattern1: 'custom-*',
        rulePattern2: 'custom-*',
        conflictType: ConflictType.SCOPE_CONFLICT,
        severity: ConflictSeverity.MEDIUM,
        resolutionStrategy: ResolutionStrategy.PREFER_FIRST,
        description: 'Custom rule conflict',
      };

      const detectorWithCustom = new ConflictDetector({ customRules: [customRule] });

      const violations: RuleViolation[] = [
        {
          ruleId: 'custom-001',
          type: 'custom',
          severity: 'medium',
          message: 'Custom rule 1',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'custom-002',
          type: 'custom',
          severity: 'medium',
          message: 'Custom rule 2',
          location: { file: 'contract.sol', line: 20 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'custom-001', message: 'Suggestion 1' },
        { ruleId: 'custom-002', message: 'Suggestion 2' },
      ];

      const result = detectorWithCustom.detectConflicts(violations, suggestions);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].conflictType).toBe(ConflictType.SCOPE_CONFLICT);
    });
  });

  describe('getResolutionStrategy', () => {
    it('should return resolution strategy for known conflicts', () => {
      const violations: RuleViolation[] = [
        {
          ruleId: 'gas-001',
          type: 'gas',
          severity: 'medium',
          message: 'Optimization',
          location: { file: 'contract.sol', line: 10 },
        },
        {
          ruleId: 'gas-002',
          type: 'gas',
          severity: 'medium',
          message: 'Other optimization',
          location: { file: 'contract.sol', line: 20 },
        },
      ];

      const suggestions: Suggestion[] = [
        { ruleId: 'gas-001', message: 'Suggestion 1' },
        { ruleId: 'gas-002', message: 'Suggestion 2' },
      ];

      const result = detector.detectConflicts(violations, suggestions);
      const strategy = detector.getResolutionStrategy(result.conflicts[0]);

      expect(strategy).toBe(ResolutionStrategy.REQUIRE_USER_INPUT);
    });
  });
});

describe('ConflictWarner', () => {
  let warner: ConflictWarner;

  beforeEach(() => {
    warner = new ConflictWarner();
  });

  describe('generateWarnings', () => {
    it('should return empty array when no conflicts', () => {
      const result = {
        hasConflicts: false,
        conflicts: [],
        conflictCounts: { low: 0, medium: 0, high: 0 },
      };

      const warnings = warner.generateWarnings(result);

      expect(warnings).toHaveLength(0);
    });

    it('should generate summary warning', () => {
      const result = {
        hasConflicts: true,
        conflicts: [],
        conflictCounts: { low: 1, medium: 2, high: 0 },
      };

      const warnings = warner.generateWarnings(result);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('3 conflict');
    });

    it('should mark high severity conflicts as critical', () => {
      const result = {
        hasConflicts: true,
        conflicts: [
          {
            conflictType: ConflictType.DEPENDENCY_VIOLATION,
            severity: ConflictSeverity.HIGH,
            description: 'Critical conflict',
            involvedRules: ['rule-1', 'rule-2'],
            violations: [],
            conflictingSuggestions: [],
            resolutionSuggestion: 'Fix it',
          },
        ],
        conflictCounts: { low: 0, medium: 0, high: 1 },
      };

      const warnings = warner.generateWarnings(result);

      expect(warnings[1].critical).toBe(true);
      expect(warnings[1].severity).toBe(ConflictSeverity.HIGH);
    });
  });

  describe('getStatusMessage', () => {
    it('should return success message when no conflicts', () => {
      const result = {
        hasConflicts: false,
        conflicts: [],
        conflictCounts: { low: 0, medium: 0, high: 0 },
      };

      const message = warner.getStatusMessage(result);

      expect(message).toContain('No conflicts');
    });

    it('should return critical message for high severity conflicts', () => {
      const result = {
        hasConflicts: true,
        conflicts: [],
        conflictCounts: { low: 0, medium: 0, high: 2 },
      };

      const message = warner.getStatusMessage(result);

      expect(message).toContain('critical');
    });

    it('should return warning message for medium severity conflicts', () => {
      const result = {
        hasConflicts: true,
        conflicts: [],
        conflictCounts: { low: 0, medium: 1, high: 0 },
      };

      const message = warner.getStatusMessage(result);

      expect(message).toContain('⚠️');
    });
  });

  describe('shouldBlockExecution', () => {
    it('should block execution when high severity conflicts exist', () => {
      const result = {
        hasConflicts: true,
        conflicts: [],
        conflictCounts: { low: 0, medium: 0, high: 1 },
      };

      expect(warner.shouldBlockExecution(result)).toBe(true);
    });

    it('should not block execution when only low/medium conflicts exist', () => {
      const result = {
        hasConflicts: true,
        conflicts: [],
        conflictCounts: { low: 2, medium: 1, high: 0 },
      };

      expect(warner.shouldBlockExecution(result)).toBe(false);
    });
  });

  describe('generateStructuredWarnings', () => {
    it('should generate machine-readable warnings', () => {
      const result = {
        hasConflicts: true,
        conflicts: [
          {
            conflictType: ConflictType.OVERLAPPING_MODIFICATION,
            severity: ConflictSeverity.MEDIUM,
            description: 'Test conflict',
            involvedRules: ['rule-1', 'rule-2'],
            violations: [],
            conflictingSuggestions: [],
            location: { file: 'test.sol', line: 10 },
            resolutionSuggestion: 'Resolve manually',
          },
        ],
        conflictCounts: { low: 0, medium: 1, high: 0 },
      };

      const structured = warner.generateStructuredWarnings(result);

      expect(structured.summary).toBeDefined();
      expect(structured.conflicts).toHaveLength(1);
      expect(structured.conflicts[0].type).toBe('OVERLAPPING_MODIFICATION');
      expect(structured.conflicts[0].location).toBe('test.sol:10');
    });
  });
});
