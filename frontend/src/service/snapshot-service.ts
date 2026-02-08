import { Injectable } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { ClanMember, ClanSnapshot } from '@clan-manager/shared';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SnapshotService {

  // Min total history = (100 snaps * 4 hours) / 24 hours = 16.7 days.
  private readonly MAX_SNAPSHOTS = 100;
  private readonly MIN_TIME_BETWEEN_SNAPSHOTS_MS = 1000 * 60 * 60 * 4; // 4 hours
  private readonly API_URL = '/api/snapshots';

  constructor(private http: HttpClient) {}

  /**
   * Syncs backend data with local storage and returns the merged history.
   */
  public getSnapshotHistory(clanTag: string): Observable<ClanSnapshot[]> {
    console.log("Getting snapshot history for " + clanTag);
    const localData = localStorage.getItem(this.getStorageKey(clanTag));
    const localHistory: ClanSnapshot[] = localData ? JSON.parse(localData) : [];

    // Find the newest local timestamp to avoid fetching duplicates
    const latestLocal = localHistory.length > 0 ? localHistory[0].timestamp : null;
    let params = new HttpParams();
    if (latestLocal) {
      params = params.set('since', new Date(latestLocal).toISOString());
    }

    const encodedTag = encodeURIComponent(clanTag);
    console.log("  Fetching from the backend... " + `${this.API_URL}/${encodedTag}`);
    return this.http.get<ClanSnapshot[]>(`${this.API_URL}/${encodedTag}`, { params }).pipe(
      map(remoteHistory => {
        console.log("  ...got the backend results.");
        // Merge: Remote (newer) + Local
        // We filter remoteHistory just in case of slight clock drifts
        const merged = [...remoteHistory, ...localHistory]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, this.MAX_SNAPSHOTS);

        // Update local storage with the fresh batch
        localStorage.setItem(this.getStorageKey(clanTag), JSON.stringify(merged));
        console.log("  Updated local storage with the data");
        return merged;
      })
    );
  }

  public saveSnapshot(clanTag: string, membersSnapshot: ClanMember[], allSnapshots: ClanSnapshot[]): Observable<ClanSnapshot | null> {
    if (!this.shouldSaveSnapshot(allSnapshots)) {
      console.log("Snapshot too recent. Skipping save.");
      return of(null);
    }

    const newSnapshot: ClanSnapshot = {
      clanTag,
      timestamp: new Date(),
      members: membersSnapshot
    };

    // Post to backend first
    return this.http.post<ClanSnapshot>(this.API_URL, newSnapshot).pipe(
      tap(savedSnap => {
        // Add the saved version (with ID) to local storage
        allSnapshots.unshift(savedSnap);
        const capped = allSnapshots.slice(0, this.MAX_SNAPSHOTS);
        localStorage.setItem(this.getStorageKey(clanTag), JSON.stringify(capped));
      })
    );
  }

  private shouldSaveSnapshot(history: ClanSnapshot[]): boolean {
    if (history.length === 0) return true;
    const lastSnapshot = history[0];
    const now = Date.now();
    const timeSinceLastSnapshot = now - new Date(lastSnapshot.timestamp).getTime();
    return timeSinceLastSnapshot > this.MIN_TIME_BETWEEN_SNAPSHOTS_MS;
  }

  /**
   * The cookie key for storing snapshots for this clan.
   * @param clanTag The clan for which to get the storage key.
   * @returns 
   */
  private getStorageKey(clanTag: string): string {
    return `snapshots_${clanTag}`;
  }
}
