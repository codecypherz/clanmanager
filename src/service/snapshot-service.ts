import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { ClanMember, ClanSnapshot } from '../model/clan-member';

@Injectable({ providedIn: 'root' })
export class SnapshotService {
  private readonly MAX_SNAPSHOTS = 100;

  /**
   * Gets the full snapshot history for the clan.
   * @param clanTag The clan for which to get history.
   * @returns 
   */
  getSnapshotHistory(clanTag: string): Observable<ClanSnapshot[]> {
    const data = localStorage.getItem(this.getStorageKey(clanTag));
    const history: ClanSnapshot[] = data ? JSON.parse(data) : [];
    return of(history); 
  }

  /**
   * Returns the most recent snapshot or null if there is no history.
   * @param clanTag The clan for which to get the history.
   * @returns
   */
  getLatestSnapshot(clanTag: string): Observable<ClanSnapshot | null> {
    // We pipe the history and return the first element (or null if empty)
    return this.getSnapshotHistory(clanTag).pipe(
      map(history => (history.length > 0 ? history[0] : null)));
  }

  /**
   * Saves this clan's member list as a snapshot.
   * If the history is full, the oldest entry is dropped.
   * @param clanTag The clan for which to save history.
   * @param members The data to save for the clan.
   */
  saveSnapshot(clanTag: string, members: ClanMember[]): Observable<void> {
    return this.getSnapshotHistory(clanTag).pipe(
      map(history => {
        const newSnapshot: ClanSnapshot = {
          clanTag,
          timestamp: new Date(),
          members: members
        };

        // Add new snapshot to the front
        history.unshift(newSnapshot);

        // Keep only the last 100
        const cappedHistory = history.slice(0, this.MAX_SNAPSHOTS);

        // Write the cookie with the serialized payload.
        localStorage.setItem(this.getStorageKey(clanTag), JSON.stringify(cappedHistory));

        return void 0; // Emit and complete.
      })
    );
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
