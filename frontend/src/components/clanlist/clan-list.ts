import { Component, OnInit } from '@angular/core';
import { ClashRoyaleService } from '../../service/clash-royale';
import { ClanMember, ClanResult, Eval, WarParticipant } from '../../../../shared/models/clan-member';
import { Observable, timer, switchMap, shareReplay, map } from 'rxjs';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';

const GUINEA_GUNS_TAG = '#QJCLJ8LR';

interface Unit {
  label: string;
  ms: number;
}

const UNITS: Unit[] = [
  { label: 'day', ms: 86400000 },
  { label: 'hour', ms: 3600000 },
  { label: 'minute', ms: 60000 },
  { label: 'second', ms: 1000 },
];

@Component({
  selector: 'app-clan-list',
  templateUrl: './clan-list.html',
  imports: [AsyncPipe, NgTemplateOutlet]
})
export class ClanListComponent implements OnInit {

  private readonly REFRESH_INTERVAL_MS = 1000 * 60 * 60; // 1 hour.

  clanResult$: Observable<ClanResult> | undefined;
  activeMembers$: Observable<ClanMember[]> | undefined;
  historicalMembers$: Observable<ClanMember[]> | undefined;

  errorMessage: string = '';
  lastFetch: Date | undefined;

  constructor(
    private crService: ClashRoyaleService) {}

  ngOnInit(): void {
    // Refresh the data for the view periodically, but also fetch immediately.
    this.clanResult$ = timer(0, this.REFRESH_INTERVAL_MS).pipe(
      // switchMap cancels the previous request if it's still pending
      switchMap(() => {
        this.lastFetch = new Date();
        return this.crService.getClanMembers(GUINEA_GUNS_TAG);
      }),
      shareReplay(1));

    // Derive the filtered lists from the main stream
    this.activeMembers$ = this.clanResult$.pipe(
      map(result => {
        return result.allMembers
          .filter(m => !m.historical)
          .sort((a, b) => {
            // Handle null/undefined war objects by defaulting fame to 0
            const fameA = a.currentWar?.fame ?? 0;
            const fameB = b.currentWar?.fame ?? 0;
            
            // Sort descending (highest points first)
            if (fameB - fameA == 0) {
              // Tie break on trophies
              return b.trophies - a.trophies;
            }
            return fameB - fameA;
          });
      })
    );

    this.historicalMembers$ = this.clanResult$.pipe(
      map(result => result.allMembers.filter(m => m.historical))
    );
  }

  getRelativeTime(timestamp: number | Date): string {
    const diff = new Date().getTime() - new Date(timestamp).getTime();
    if (diff < 60000) return 'Just now';
    
    // Find the largest unit that fits
    for (const { label, ms: unitMs } of UNITS) {
      const count = Math.floor(diff / unitMs);
      if (count > 0) {
        return `${count}${label.charAt(0)} ago`; // e.g., "3d", "5h"
      }
    }
    return 'unknown';
  }

  getFameText(war: WarParticipant | undefined): string {
    if (war && war.warEval != Eval.NOT_APPLICABLE) {
      return war.fame.toString();
    }
    return "N/A";
  }

  getActiveWarDays(war : WarParticipant | undefined): string {
    if (war && war.warEval != Eval.NOT_APPLICABLE) {
      let warDaysActive = war.warDaysActive || 0;
      return "(" + warDaysActive + ")";
    }
    return "N/A";
  }

  isPartialParticipation(war : WarParticipant | undefined): boolean {
    if (war && war.warEval != Eval.NOT_APPLICABLE) {
      let warDaysActive = war.warDaysActive || 0;
      return warDaysActive > 0 && warDaysActive < 4;
    }
    return false;
  }
}
