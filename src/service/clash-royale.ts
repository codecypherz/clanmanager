

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClanMember } from '../model/clan-member';
import { environment } from '../environments/environment';

const apiKey = import.meta.env.NG_APP_CLASH_API_KEY;

@Injectable({
  providedIn: 'root'
})
export class ClashRoyaleService {
  
  private baseUrl = environment.baseClashRoyaleApiUrl;

  constructor(private http: HttpClient) {}

  getClanMembers(clanTag: string): Observable<ClanMemberListResponse> {
    // Clan tags in the URL must be URL-encoded (replace # with %23)
    const encodedTag = encodeURIComponent(clanTag);
    const url = `${this.baseUrl}/clans/${encodedTag}/members`;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`
    });

    return this.http.get<ClanMemberListResponse>(url, { headers });
  }
}

export interface ClanMemberListResponse {
  items: ClanMember[];
}
