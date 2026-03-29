import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClashRoyaleService, ClanResponse, CurrentRiverRaceResponse, RiverRaceLogResponse } from './clash-royale';
import { SnapshotService } from './snapshot-service';
import { of, firstValueFrom } from 'rxjs';
import { ClanMember, ClanSnapshot, Eval, WarParticipant } from '@clan-manager/shared';

describe('ClashRoyaleService', () => {
  let service: ClashRoyaleService;
  let httpMock: HttpTestingController;

  const mockSnapshotService = {
    getSnapshotHistory: vi.fn(),
    saveSnapshot: vi.fn()
  };

  const clanTag = '#PURGE';
  const encodedTag = encodeURIComponent(clanTag);

  // Set a fixed date: Tuesday Feb 17, 2026 12:00 UTC (not a war day).
  // This means war data comes from warLog, not currentWar.
  // getThursdayReset(0) = Thursday Feb 12 10:00 UTC
  // War window: Feb 12 10:00 → Feb 16 10:00 (4 days, fully elapsed)
  // For a member present the full war: 4 days active
  //   goodFame = 4 * 400 = 1600
  //   kickThreshold = (4-1) * 400 = 1200
  const TUESDAY = new Date('2026-02-17T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TUESDAY);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ClashRoyaleService,
        { provide: SnapshotService, useValue: mockSnapshotService }
      ]
    });

    service = TestBed.inject(ClashRoyaleService);
    httpMock = TestBed.inject(HttpTestingController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  // Helper: flush the 3 HTTP requests that getClanMembers fires in parallel
  function flushRequests(
    members: ClanResponse,
    currentWar: CurrentRiverRaceResponse,
    warLog: RiverRaceLogResponse,
    snapshots: ClanSnapshot[] = []
  ) {
    mockSnapshotService.getSnapshotHistory.mockReturnValue(of(snapshots));
    mockSnapshotService.saveSnapshot.mockReturnValue(of(null));

    const resultPromise = firstValueFrom(service.getClanMembers(clanTag));

    httpMock.expectOne(req =>
      req.url.includes(`/clans/${encodedTag}`) &&
      !req.url.includes('currentriverrace') &&
      !req.url.includes('riverracelog')
    ).flush(members);

    httpMock.expectOne(req =>
      req.url.includes(`${encodedTag}/currentriverrace`)
    ).flush(currentWar);

    httpMock.expectOne(req =>
      req.url.includes(`${encodedTag}/riverracelog`)
    ).flush(warLog);

    return resultPromise;
  }

  // Minimal stubs reused across tests
  function makeMember(overrides: Partial<ClanMember>): ClanMember {
    return {
      tag: '#USER1', name: 'Player 1', role: 'member',
      donations: 100, lastSeen: '20260217T100000Z',
      trophies: 5000, expLevel: 14,
      ...overrides
    } as ClanMember;
  }

  const emptyCurrentWar: CurrentRiverRaceResponse = {
    clan: { tag: clanTag, participants: [] }
  };

  // A snapshot from before the war window (Feb 12) that establishes the member
  // was in the clan, so setHistoricalMembershipData sets a join time before the war.
  function preWarSnapshot(tags: string[]): ClanSnapshot[] {
    return [{
      clanTag,
      timestamp: new Date('2026-02-01T10:00:00Z'),
      members: tags.map(tag => makeMember({ tag }))
    }];
  }

  function makeWarLog(participantsByWeek: WarParticipant[][]): RiverRaceLogResponse {
    return {
      items: participantsByWeek.map(participants => ({
        standings: [{ clan: { tag: clanTag, participants } }]
      }))
    };
  }

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  describe('getClanMembers', () => {
    it('should set roleCode and donationEval on returned members', async () => {
      const members: ClanResponse = {
        memberList: [
          makeMember({ tag: '#A', role: 'leader', donations: 500 }),
          makeMember({ tag: '#B', role: 'coLeader', donations: 0 }),
          makeMember({ tag: '#C', role: 'elder', donations: 10 }),
          makeMember({ tag: '#D', role: 'member', donations: 0 }),
        ]
      };

      const result = await flushRequests(members, emptyCurrentWar, makeWarLog([]));
      const byTag = Object.fromEntries(result.allMembers.map(m => [m.tag, m]));

      expect(byTag['#A'].roleCode).toBe('L');
      expect(byTag['#B'].roleCode).toBe('C');
      expect(byTag['#C'].roleCode).toBe('E');
      expect(byTag['#D'].roleCode).toBe('M');

      expect(byTag['#A'].donationEval).toBe(Eval.GOOD);
      expect(byTag['#B'].donationEval).toBe(Eval.BAD);
    });

    it('should parse the API lastSeen format into a Date', async () => {
      const members: ClanResponse = {
        memberList: [makeMember({ lastSeen: '20260221T100000Z' })]
      };

      const result = await flushRequests(members, emptyCurrentWar, makeWarLog([]));

      const parsed = result.allMembers[0].lastSeenParsed;
      expect(parsed.getUTCFullYear()).toBe(2026);
      expect(parsed.getUTCMonth()).toBe(1); // February
      expect(parsed.getUTCDate()).toBe(21);
    });

    it('should flag a member for kick when war fame is at or below the kick threshold', async () => {
      // 0 fame with 4 active days → kickThreshold = 1200, fame <= 1200 → kick
      const warParticipants: WarParticipant[] = [
        { tag: '#USER1', fame: 0 } as WarParticipant
      ];
      const members: ClanResponse = { memberList: [makeMember({})] };

      const result = await flushRequests(
        members, emptyCurrentWar,
        makeWarLog([warParticipants]),
        preWarSnapshot(['#USER1'])
      );

      const member = result.allMembers[0];
      expect(member.shouldKick).toBe(true);
      expect(member.currentWar?.warEval).toBe(Eval.BAD);
    });

    it('should NOT flag a member for kick when fame meets the good threshold', async () => {
      // 1600 fame with 4 active days → goodFame = 1600, fame >= 1600 → GOOD
      const warParticipants: WarParticipant[] = [
        { tag: '#USER1', fame: 1600 } as WarParticipant
      ];
      const members: ClanResponse = { memberList: [makeMember({})] };

      const result = await flushRequests(
        members, emptyCurrentWar,
        makeWarLog([warParticipants]),
        preWarSnapshot(['#USER1'])
      );

      const member = result.allMembers[0];
      expect(member.shouldKick).toBe(false);
      expect(member.currentWar?.warEval).toBe(Eval.GOOD);
    });

    it('should evaluate fame between kick and good thresholds as NEUTRAL', async () => {
      // 1400 fame: above kickThreshold (1200) but below goodFame (1600) → NEUTRAL
      const warParticipants: WarParticipant[] = [
        { tag: '#USER1', fame: 1400 } as WarParticipant
      ];
      const members: ClanResponse = { memberList: [makeMember({})] };

      const result = await flushRequests(
        members, emptyCurrentWar,
        makeWarLog([warParticipants]),
        preWarSnapshot(['#USER1'])
      );

      const member = result.allMembers[0];
      expect(member.shouldKick).toBe(false);
      expect(member.currentWar?.warEval).toBe(Eval.NEUTRAL);
    });

    it('should flag kick if ANY of the 3 war weeks has bad participation', async () => {
      // Good in current war, bad in last war
      const goodWar: WarParticipant[] = [{ tag: '#USER1', fame: 1600 } as WarParticipant];
      const badWar: WarParticipant[] = [{ tag: '#USER1', fame: 0 } as WarParticipant];

      const members: ClanResponse = { memberList: [makeMember({})] };

      const result = await flushRequests(
        members, emptyCurrentWar,
        makeWarLog([goodWar, badWar]),
        preWarSnapshot(['#USER1'])
      );

      expect(result.allMembers[0].shouldKick).toBe(true);
    });

    it('should not kick a member with no war participation data', async () => {
      const members: ClanResponse = { memberList: [makeMember({})] };

      const result = await flushRequests(
        members, emptyCurrentWar,
        makeWarLog([]) // no war log entries
      );

      expect(result.allMembers[0].shouldKick).toBe(false);
    });

    it('should include historical members from snapshots who are no longer current', async () => {
      const currentMember = makeMember({ tag: '#CURRENT', name: 'Current' });
      const leftMember = makeMember({ tag: '#LEFT', name: 'Left Player', donations: 50 });

      const members: ClanResponse = { memberList: [currentMember] };
      const snapshots: ClanSnapshot[] = [
        {
          clanTag,
          timestamp: new Date('2026-02-15T10:00:00Z'),
          members: [
            makeMember({ tag: '#CURRENT', name: 'Current' }),
            makeMember({ tag: '#LEFT', name: 'Left Player', donations: 50 })
          ]
        }
      ];

      const result = await flushRequests(
        members, emptyCurrentWar, makeWarLog([]), snapshots
      );

      expect(result.currentMemberCount).toBe(1);
      const historical = result.allMembers.filter(m => m.historical);
      expect(historical.length).toBe(1);
      expect(historical[0].tag).toBe('#LEFT');
    });

    it('should never flag historical members for kick', async () => {
      const members: ClanResponse = { memberList: [] };
      const snapshots: ClanSnapshot[] = [
        {
          clanTag,
          timestamp: new Date('2026-02-15T10:00:00Z'),
          members: [makeMember({ tag: '#GONE', donations: 0 })]
        }
      ];

      const result = await flushRequests(
        members, emptyCurrentWar, makeWarLog([]), snapshots
      );

      const gone = result.allMembers.find(m => m.tag === '#GONE');
      expect(gone?.historical).toBe(true);
      expect(gone?.shouldKick).toBe(false);
    });

    it('should track join count across snapshots', async () => {
      const members: ClanResponse = { memberList: [makeMember({ tag: '#REJOINER' })] };

      // Snapshots go newest → oldest. This member left and came back.
      const snapshots: ClanSnapshot[] = [
        { clanTag, timestamp: new Date('2026-02-16T10:00:00Z'), members: [makeMember({ tag: '#REJOINER' })] },
        { clanTag, timestamp: new Date('2026-02-14T10:00:00Z'), members: [] }, // not present = left
        { clanTag, timestamp: new Date('2026-02-12T10:00:00Z'), members: [makeMember({ tag: '#REJOINER' })] },
      ];

      const result = await flushRequests(
        members, emptyCurrentWar, makeWarLog([]), snapshots
      );

      const rejoiner = result.allMembers.find(m => m.tag === '#REJOINER');
      expect(rejoiner?.joinCount).toBe(2);
    });

    it('should save a snapshot after processing', async () => {
      const members: ClanResponse = { memberList: [makeMember({})] };

      await flushRequests(members, emptyCurrentWar, makeWarLog([]));

      expect(mockSnapshotService.saveSnapshot).toHaveBeenCalledOnce();
    });
  });

  describe('war day calculation', () => {
    // These test the date-dependent branching that determines which war data source is used.
    // Tested via private access because the behavior (which warLog index is read) is hard
    // to distinguish through the public API without fragile mock setups.

    it('should identify Friday-Sunday as war days', () => {
      vi.setSystemTime(new Date('2026-02-20T12:00:00Z')); // Friday
      expect((service as any).isWarDay()).toBe(true);

      vi.setSystemTime(new Date('2026-02-21T12:00:00Z')); // Saturday
      expect((service as any).isWarDay()).toBe(true);

      vi.setSystemTime(new Date('2026-02-22T12:00:00Z')); // Sunday
      expect((service as any).isWarDay()).toBe(true);
    });

    it('should identify Tuesday-Wednesday as non-war days', () => {
      vi.setSystemTime(new Date('2026-02-17T12:00:00Z')); // Tuesday
      expect((service as any).isWarDay()).toBe(false);

      vi.setSystemTime(new Date('2026-02-18T12:00:00Z')); // Wednesday
      expect((service as any).isWarDay()).toBe(false);
    });

    it('should treat Thursday as war day only after reset hour (10 UTC)', () => {
      vi.setSystemTime(new Date('2026-02-19T09:00:00Z')); // Thursday before reset
      expect((service as any).isWarDay()).toBe(false);

      vi.setSystemTime(new Date('2026-02-19T11:00:00Z')); // Thursday after reset
      expect((service as any).isWarDay()).toBe(true);
    });

    it('should treat Monday as war day only before reset hour (10 UTC)', () => {
      vi.setSystemTime(new Date('2026-02-23T09:00:00Z')); // Monday before reset
      expect((service as any).isWarDay()).toBe(true);

      vi.setSystemTime(new Date('2026-02-23T11:00:00Z')); // Monday after reset
      expect((service as any).isWarDay()).toBe(false);
    });
  });
});
