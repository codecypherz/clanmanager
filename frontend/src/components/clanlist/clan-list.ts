import { Component, OnInit } from '@angular/core';
import { ClashRoyaleService } from '../../service/clash-royale';
import { ClanMember, ClanResult } from '../../../../shared/models/clan-member';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';
import { AsyncPipe } from '@angular/common';

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
  imports: [AsyncPipe]
})
export class ClanListComponent implements OnInit {

  private readonly DATE_FORMAT = new Intl.DateTimeFormat(
    'en-US', {
      month: 'numeric',
      day: 'numeric'
    });

  private readonly DATE_TOOLTIP_FORMAT = new Intl.DateTimeFormat(
    'en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });

  private readonly REFRESH_INTERVAL_MS = 1000 * 60 * 60; // 1 hour.

  clanResult$: Observable<ClanResult> | undefined;
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
  }

  getFreshnessTooltip(clanResult: ClanResult) {
    return "Last fetch: " + this.DATE_TOOLTIP_FORMAT.format(this.lastFetch) +
        "\nLast snapshot: " + this.DATE_TOOLTIP_FORMAT.format(clanResult.lastSnapshotTime) +
        "\nData window: " + this.formatDuration(clanResult.dataWindowMs);
  }

  getLastSeen(member: ClanMember): string {
    return this.DATE_FORMAT.format(member.lastSeenParsed);
  }

  getLastSeenTooltip(member: ClanMember): string {
    const now = new Date();
    const lastSeen = member.lastSeenParsed;
    const diff = now.getTime() - lastSeen.getTime();
    return this.DATE_TOOLTIP_FORMAT.format(lastSeen) + " (" + this.formatDuration(diff) + " ago)";
  }

  getJoinDate(member: ClanMember): string {
    return this.DATE_FORMAT.format(new Date(member.earliestMembershipTimestamp));
  }

  getJoinDateTooltip(member: ClanMember): string {
    const now = new Date();
    const joinDate = new Date(member.earliestMembershipTimestamp);
    const diff = now.getTime() - joinDate.getTime();
    return this.DATE_TOOLTIP_FORMAT.format(joinDate) + " (" + this.formatDuration(diff) + " ago)";
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `1s`;

    const parts: string[] = [];
    let remainingMs = ms;

    for (const { label, ms: unitMs } of UNITS) {
      const count = Math.floor(remainingMs / unitMs);
      if (count > 0) {
        parts.push(`${count} ${label}${count !== 1 ? 's' : ''}`);
        remainingMs %= unitMs;
      }
    }

    return parts.join(', ');
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
}
