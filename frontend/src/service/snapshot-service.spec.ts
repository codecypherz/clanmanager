import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SnapshotService } from './snapshot-service';
import { ClanSnapshot, ClanMember } from '@clan-manager/shared';
import { firstValueFrom } from 'rxjs';

describe('SnapshotService', () => {
  let service: SnapshotService;
  let httpMock: HttpTestingController;
  const clanTag = 'TEST_CLAN';
  const storageKey = `snapshots_${clanTag}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SnapshotService]
    });

    service = TestBed.inject(SnapshotService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('getSnapshotHistory', () => {
    it('should fetch from backend and merge with localStorage', async () => {
      // 1. Setup Local Storage
      const localSnap = { 
        clanTag, 
        timestamp: new Date('2026-01-01T00:00:00Z').toISOString(), 
        members: [] 
      } as unknown as ClanSnapshot;
      localStorage.setItem(storageKey, JSON.stringify([localSnap]));

      // 2. Start the request
      const historyPromise = firstValueFrom(service.getSnapshotHistory(clanTag));

      // 3. Handle the HTTP mock
      const req = httpMock.expectOne(r => r.url.includes(encodeURIComponent(clanTag)));
      const remoteSnap = { 
        clanTag, 
        timestamp: new Date('2026-02-21T10:00:00Z').toISOString(), 
        members: [] 
      } as unknown as ClanSnapshot;
      
      req.flush([remoteSnap]);

      // 4. Await and Assert
      const history = await historyPromise;
      expect(history.length).toBe(2);
      expect(history[0].timestamp).toBe(remoteSnap.timestamp);
      
      const stored = JSON.parse(localStorage.getItem(storageKey)!);
      expect(stored.length).toBe(2);
    });
  });

  describe('saveSnapshot', () => {
    it('should return null and not call API if snapshot is too recent', async () => {
      const history: ClanSnapshot[] = [{
        clanTag,
        timestamp: new Date(Date.now() - (1000 * 60 * 60 * 2)), // 2 hours ago
        members: []
      } as any];

      const result = await firstValueFrom(service.saveSnapshot(clanTag, [], history));
      
      expect(result).toBeNull();
      httpMock.expectNone('/api/snapshots');
    });

    it('should POST new snapshot if enough time has passed', async () => {
      const history: ClanSnapshot[] = [{
        clanTag,
        timestamp: new Date(Date.now() - (1000 * 60 * 60 * 6)), // 6 hours ago
        members: []
      } as any];

      const savePromise = firstValueFrom(service.saveSnapshot(clanTag, [], history));

      const req = httpMock.expectOne('/api/snapshots');
      const mockSaved = { clanTag, timestamp: new Date(), members: [] } as any;
      req.flush(mockSaved);

      const result = await savePromise;
      expect(result).toBeTruthy();
      expect(history.length).toBe(2); // Verify unshift worked
    });
  });
});
