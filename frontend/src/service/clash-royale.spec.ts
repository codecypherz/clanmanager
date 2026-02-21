import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClashRoyaleService, ClanResponse, CurrentRiverRaceResponse, RiverRaceLogResponse } from './clash-royale';
import { SnapshotService } from './snapshot-service';
import { of, firstValueFrom } from 'rxjs';
import { ClanSnapshot, Eval } from '@clan-manager/shared';

describe('ClashRoyaleService', () => {
  let service: ClashRoyaleService;
  let httpMock: HttpTestingController;
  
  // Create a mock object for the SnapshotService
  const mockSnapshotService = {
    getSnapshotHistory: vi.fn(),
    saveSnapshot: vi.fn()
  };

  const clanTag = '#PURGE';
  const encodedTag = encodeURIComponent(clanTag);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ClashRoyaleService,
        { provide: SnapshotService, useValue: mockSnapshotService }
      ]
    });

    service = TestBed.inject(ClashRoyaleService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // Clear mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  describe('getClanMembers', () => {
    it('should aggregate all API data and process members correctly', async () => {
      // 1. Mock Data Setup
      const mockMembers: ClanResponse = {
        memberList: [
          { tag: '#USER1', name: 'Player 1', role: 'leader', donations: 500, lastSeen: '20260221T100000Z' } as any
        ]
      };

      const mockCurrentWar: CurrentRiverRaceResponse = {
        clan: { tag: clanTag, participants: [{ tag: '#USER1', fame: 1600 } as any] }
      };

      const mockWarLog: RiverRaceLogResponse = { items: [] };
      const mockSnapshots: ClanSnapshot[] = [];

      // 2. Setup Mock Returns
      mockSnapshotService.getSnapshotHistory.mockReturnValue(of(mockSnapshots));
      mockSnapshotService.saveSnapshot.mockReturnValue(of(null));

      // 3. Initiate the call
      const resultPromise = firstValueFrom(service.getClanMembers(clanTag));

      // 4. Resolve the parallel HTTP requests
      // This matches the base members call (ensure it doesn't end with war endpoints)
      httpMock.expectOne(req => 
        req.url.endsWith(encodedTag) || req.url.endsWith(`${encodedTag}/`)
      ).flush(mockMembers);

      // This matches the current war endpoint
      httpMock.expectOne(req => 
        req.url.includes(`${encodedTag}/currentriverrace`)
      ).flush(mockCurrentWar);

      // This matches the war log endpoint
      httpMock.expectOne(req => 
        req.url.includes(`${encodedTag}/riverracelog`)
      ).flush(mockWarLog);

      const result = await resultPromise;

      // 5. Assertions
      expect(result.allMembers.length).toBe(1);
      expect(result.allMembers[0].roleCode).toBe('L');
      expect(result.allMembers[0].donationEval).toBe(Eval.GOOD);
      expect(mockSnapshotService.saveSnapshot).toHaveBeenCalled();
    });
  });

  describe('Internal Logic (Private Methods)', () => {
    it('should map role strings to single character codes', () => {
      // Accessing private methods via any casting
      const svc = service as any;
      expect(svc.getRoleCode('leader')).toBe('L');
      expect(svc.getRoleCode('coLeader')).toBe('C');
      expect(svc.getRoleCode('elder')).toBe('E');
      expect(svc.getRoleCode('member')).toBe('M');
    });

    it('should parse the API date format into a standard Date object', () => {
      const apiDate = '20260221T100000Z';
      const parsed: Date = (service as any).parseLastSeen(apiDate);
      
      expect(parsed.getUTCFullYear()).toBe(2026);
      expect(parsed.getUTCMonth()).toBe(1); // February is index 1
      expect(parsed.getUTCDate()).toBe(21);
    });
  });

  describe('War Day Calculation', () => {
    it('should identify Friday as a war day', () => {
      // Using Vitest to mock system time
      vi.useFakeTimers();
      const friday = new Date('2026-02-20T12:00:00Z');
      vi.setSystemTime(friday);

      expect((service as any).isWarDay()).toBe(true);

      vi.useRealTimers();
    });

    it('should identify Tuesday as NOT a war day', () => {
      vi.useFakeTimers();
      const tuesday = new Date('2026-02-17T12:00:00Z');
      vi.setSystemTime(tuesday);

      expect((service as any).isWarDay()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Donation Evaluation', () => {
    it('should mark members with 0 donations as BAD', () => {
      const badMember = { donations: 0 } as any;
      const result = (service as any).evaluateDonations(badMember);
      expect(result).toBe(Eval.BAD);
    });

    it('should mark members with donations as GOOD', () => {
      const goodMember = { donations: 10 } as any;
      const result = (service as any).evaluateDonations(goodMember);
      expect(result).toBe(Eval.GOOD);
    });
  });
});
