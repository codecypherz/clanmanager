import { Component, OnInit } from '@angular/core';
import { ClashRoyaleService } from '../../service/clash-royale';
import { ClanMember } from '../../model/clan-member';
import { Observable, catchError, map, of } from 'rxjs';
import { AsyncPipe } from '@angular/common';

const GUINEA_GUNS_TAG = '#QJCLJ8LR';

@Component({
  selector: 'app-clan-list',
  templateUrl: './clan-list.html',
  imports: [AsyncPipe]
})
export class ClanListComponent implements OnInit {
  members$: Observable<ClanMember[]> | undefined;
  errorMessage: string = '';

  constructor(private crService: ClashRoyaleService) {}

  ngOnInit(): void {

    this.members$ = this.crService.getClanMembers(GUINEA_GUNS_TAG).pipe(
      map(response => response.items),
      catchError(err => {
        this.errorMessage = 'Failed to load clan members.';
        console.error(err);
        return of([]); // Return an empty array on error
      })
    );

    // this.crService.getClanMembers(GUINEA_GUNS_TAG).subscribe({
    //   next: (data) => {
    //     this.members = data.items;
    //   },
    //   error: (err) => {
    //     this.errorMessage = 'Failed to load clan members. Check CORS or API Key.';
    //     console.error(err);
    //   }
    // });
  }
}