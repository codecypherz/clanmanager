import { describe, it, expect, beforeEach } from 'vitest';
import { MemberTableComponent } from './member-table';
import { Eval, WarParticipant } from '@clan-manager/shared';

describe('MemberTableComponent', () => {
  let component: MemberTableComponent;

  beforeEach(() => {
    component = new MemberTableComponent();
  });

  describe('getRelativeTime', () => {
    it('should return "Now" for timestamps less than a minute ago', () => {
      const recent = new Date(Date.now() - 30_000);
      expect(component.getRelativeTime(recent)).toBe('Now');
    });

    it('should return days for timestamps over 24h ago', () => {
      const twoDaysAgo = new Date(Date.now() - 86400000 * 2.5);
      expect(component.getRelativeTime(twoDaysAgo)).toBe('2d');
    });

    it('should return hours for timestamps a few hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3600000 * 3);
      expect(component.getRelativeTime(threeHoursAgo)).toBe('3h');
    });

    it('should return minutes for timestamps a few minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 60000 * 5.5);
      expect(component.getRelativeTime(fiveMinAgo)).toBe('5m');
    });
  });

  describe('getFameText', () => {
    it('should return the fame as a string when war is applicable', () => {
      const war = { fame: 1200, warEval: Eval.GOOD } as WarParticipant;
      expect(component.getFameText(war)).toBe('1200');
    });

    it('should return "N/A" when warEval is NOT_APPLICABLE', () => {
      const war = { fame: 0, warEval: Eval.NOT_APPLICABLE } as WarParticipant;
      expect(component.getFameText(war)).toBe('N/A');
    });

    it('should return "N/A" when war is undefined', () => {
      expect(component.getFameText(undefined)).toBe('N/A');
    });
  });

  describe('getActiveWarDays', () => {
    it('should return active days in parentheses when applicable', () => {
      const war = { warDaysActive: 3, warEval: Eval.NEUTRAL } as WarParticipant;
      expect(component.getActiveWarDays(war)).toBe('(3)');
    });

    it('should return "N/A" when warEval is NOT_APPLICABLE', () => {
      const war = { warDaysActive: 0, warEval: Eval.NOT_APPLICABLE } as WarParticipant;
      expect(component.getActiveWarDays(war)).toBe('N/A');
    });

    it('should return "N/A" when war is undefined', () => {
      expect(component.getActiveWarDays(undefined)).toBe('N/A');
    });
  });

  describe('isPartialParticipation', () => {
    it('should return true when war days active is between 1 and 3', () => {
      const war = { warDaysActive: 2, warEval: Eval.NEUTRAL } as WarParticipant;
      expect(component.isPartialParticipation(war)).toBe(true);
    });

    it('should return false when war days active is 4 (full participation)', () => {
      const war = { warDaysActive: 4, warEval: Eval.GOOD } as WarParticipant;
      expect(component.isPartialParticipation(war)).toBe(false);
    });

    it('should return false when war days active is 0', () => {
      const war = { warDaysActive: 0, warEval: Eval.NEUTRAL } as WarParticipant;
      expect(component.isPartialParticipation(war)).toBe(false);
    });

    it('should return false when warEval is NOT_APPLICABLE', () => {
      const war = { warDaysActive: 2, warEval: Eval.NOT_APPLICABLE } as WarParticipant;
      expect(component.isPartialParticipation(war)).toBe(false);
    });

    it('should return false when war is undefined', () => {
      expect(component.isPartialParticipation(undefined)).toBe(false);
    });
  });
});
