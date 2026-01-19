import { Component, OnInit } from '@angular/core';
import { ClashRoyaleService } from '../../service/clash-royale';
import { ClanMember, ClanResult } from '../../model/clan-member';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { KickCountService } from '../../service/kick-count-service';

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
    private crService: ClashRoyaleService,
    private kickCountService: KickCountService) {}

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
        "\nData window: " + this.formatDuration(clanResult.dataWindowMs);
  }

  getJoinDate(timestamp: Date): string {
    return this.DATE_FORMAT.format(new Date(timestamp));
  }

  getJoinDateTooltip(timestamp: Date): string {
    return this.DATE_TOOLTIP_FORMAT.format(new Date(timestamp));
  }

  updateKickCount(member: ClanMember, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10) || 0;
    this.kickCountService.setKickCount(member.tag, value);
    member.kickCount = value; // Update local UI state
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;

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
}
