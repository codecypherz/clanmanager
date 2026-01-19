import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { ClanMember, ClanSnapshot } from '../model/clan-member';

@Injectable({ providedIn: 'root' })
export class SnapshotService {

  private readonly MAX_SNAPSHOTS = 100; // Minimum of 4 days of history at 1 hour MIN_TIME
  private readonly MIN_TIME_BETWEEN_SNAPSHOTS_MS = 1000 * 60 * 60; // 1 hour

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
    return this.getSnapshotHistory(clanTag).pipe(map(this.getLatestSnapshot_));
  }

  private getLatestSnapshot_(history: ClanSnapshot[]): ClanSnapshot|null {
    return history.length > 0 ? history[0] : null;
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

        if (!this.shouldSaveSnapshot(history)) {
          console.log("Chose not to save the snapshot.");
          return void 0;
        }

        const newSnapshot: ClanSnapshot = {
          clanTag,
          timestamp: new Date(),
          members: members
        };

        // Add new snapshot to the front
        history.unshift(newSnapshot);

        // Log what's happening.
        if (history.length == this.MAX_SNAPSHOTS) {
          console.log("Dropping the oldest snapshot");
        }
        console.log("Saving new snapshot: ", newSnapshot);

        // Keep only the last 100
        const cappedHistory = history.slice(0, this.MAX_SNAPSHOTS);

        // Write the cookie with the serialized payload.
        localStorage.setItem(this.getStorageKey(clanTag), JSON.stringify(cappedHistory));

        return void 0; // Emit and complete.
      })
    );
  }

  private shouldSaveSnapshot(history: ClanSnapshot[]): boolean {
    const lastSnapshot = this.getLatestSnapshot_(history);
    if (lastSnapshot) {
      const now = Date.now();
      const timeSinceLastSnapshot = now - new Date(lastSnapshot.timestamp).getTime();
      return timeSinceLastSnapshot > this.MIN_TIME_BETWEEN_SNAPSHOTS_MS;
    }
    return true;
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
