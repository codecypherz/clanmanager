import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClanListComponent } from './clan-list';
import { ClashRoyaleService } from '../../service/clash-royale';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { Eval, WarParticipant } from '@clan-manager/shared';

describe('ClanListComponent', () => {
  let component: ClanListComponent;
  let fixture: ComponentFixture<ClanListComponent>;

  const mockCrService = {
    getClanMembers: () => of({
      currentMemberCount: 10,
      allMembers: [
        { tag: '#A', name: 'Alice', trophies: 6000, historical: false, currentWar: { fame: 800 } },
        { tag: '#B', name: 'Bob', trophies: 5000, historical: false, currentWar: { fame: 400 } },
        { tag: '#C', name: 'Charlie', historical: true },
      ],
      dataWindowMs: 0,
    })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClanListComponent],
      providers: [
        { provide: ClashRoyaleService, useValue: mockCrService },
        provideNoopAnimations()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClanListComponent);
    component = fixture.componentInstance;
  });

  it('should render the member count after data loads', async () => {
    fixture.autoDetectChanges();
    await new Promise(resolve => setTimeout(resolve, 10));
    fixture.detectChanges();

    const h2 = fixture.debugElement.query(By.css('h2'));
    expect(h2.nativeElement.textContent).toContain('Guinea Guns: 10/50');
  });

  it('should separate active and historical members', async () => {
    fixture.autoDetectChanges();
    await new Promise(resolve => setTimeout(resolve, 10));

    let active: any[] = [];
    let historical: any[] = [];
    component.activeMembers$!.subscribe(m => active = m);
    component.historicalMembers$!.subscribe(m => historical = m);

    expect(active.length).toBe(2);
    expect(historical.length).toBe(1);
    expect(historical[0].tag).toBe('#C');
  });

  it('should sort active members by current war fame ascending, then trophies', async () => {
    fixture.autoDetectChanges();
    await new Promise(resolve => setTimeout(resolve, 10));

    let active: any[] = [];
    component.activeMembers$!.subscribe(m => active = m);

    expect(active[0].tag).toBe('#B'); // 400 fame
    expect(active[1].tag).toBe('#A'); // 800 fame
  });

  describe('getRelativeTime', () => {
    it('should return "Now" for timestamps less than a minute ago', () => {
      const recent = new Date(Date.now() - 30_000); // 30 seconds ago
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
