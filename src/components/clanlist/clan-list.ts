import { Component, OnInit } from '@angular/core';
import { ClashRoyaleService } from '../../service/clash-royale';
import { ClanMember, ClanResult } from '../../model/clan-member';
import { Observable, catchError, map, of, identity } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { KickCountService } from '../../service/kick-count-service';

const GUINEA_GUNS_TAG = '#QJCLJ8LR';

@Component({
  selector: 'app-clan-list',
  templateUrl: './clan-list.html',
  imports: [AsyncPipe]
})
export class ClanListComponent implements OnInit {

  private DATE_FORMAT = new Intl.DateTimeFormat(
    'en-US', {
      month: 'numeric',
      day: 'numeric'
    });

  private DATE_TOOLTIP_FORMAT = new Intl.DateTimeFormat(
    'en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });

  clanResult$: Observable<ClanResult> | undefined;
  errorMessage: string = '';

  constructor(
    private crService: ClashRoyaleService,
    private kickCountService: KickCountService) {}

  ngOnInit(): void {

    this.clanResult$ = this.crService.getClanMembers(GUINEA_GUNS_TAG).pipe(
      identity,
      catchError(err => {
        this.errorMessage = 'Failed to load clan members.';
        console.error(err);
        return of(); // Return an empty array on error
      })
    );
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
}
