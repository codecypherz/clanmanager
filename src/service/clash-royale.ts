import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ClanMember, WarParticipant } from '../model/clan-member';
import { environment } from '../environments/environment';
import { map } from 'rxjs/operators';

const apiKey = import.meta.env.NG_APP_CLASH_API_KEY;

// The endpoints invoked by this service and the responses mapped come
// directly from the service defitions of the Clash Royale API.
//
// See https://developer.clashroyale.com/#/documentation for more info.
//

@Injectable({
  providedIn: 'root'
})
export class ClashRoyaleService {
  
  private baseUrl = environment.baseClashRoyaleApiUrl;

  constructor(private http: HttpClient) {}

  getClanMembers(clanTag: string): Observable<ClanMember[]> {
    // Clan tags in the URL must be URL-encoded (replace # with %23)
    const encodedTag = encodeURIComponent(clanTag);
    const url = `${this.baseUrl}/clans/${encodedTag}/members`;
    const headers = this.getHeaders();

    return forkJoin({
      members: this.http.get<ClanResponse>(`${this.baseUrl}/clans/${encodedTag}`, { headers: this.getHeaders() }),
      currentWar: this.http.get<CurrentRiverRaceResponse>(`${this.baseUrl}/clans/${encodedTag}/currentriverrace`, { headers: this.getHeaders() }),
      warLog: this.http.get<RiverRaceLogResponse>(`${this.baseUrl}/clans/${encodedTag}/riverracelog`, { headers: this.getHeaders() })
    }).pipe(
      map(({ members, currentWar, warLog }) => {
        // Find our clan's specific entry in the last completed war log
        const lastWarStandings = warLog.items[0]?.standings.find(s => s.clan.tag === clanTag);
        const lastWarParticipants = lastWarStandings?.clan.participants || [];

        const lastLastWarStandings = warLog.items[1]?.standings.find(s => s.clan.tag === clanTag);
        const lastLastWarParticipants = lastLastWarStandings?.clan.participants || [];
        
        const currentParticipants = currentWar.clan.participants;

        // Join the data
        return members.memberList.map(member => ({
          ...member,
          roleCode: this.getRoleCode(member.role),
          currentWar: currentParticipants.find(p => p.tag === member.tag),
          lastWar: lastWarParticipants.find(p => p.tag === member.tag),
          lastLastWar: lastLastWarParticipants.find(p => p.tag === member.tag)
        }));
      })
    );
  }

  getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`
    });
  }

  getRoleCode(role: string): string {
    switch(role) {
      case "leader":
        return "L";
      case "coLeader":
        return "C";
      case "elder":
        return "E";
      case "member":
        return "M";
      default:
        return role;
    }
  }
}

export interface ClanResponse {
  memberList: ClanMember[];
}

export interface CurrentRiverRaceResponse {
  clan: {
    tag: string;
    participants: WarParticipant[];
  };
}

export interface RiverRaceLogResponse {
  items: Array<{
    standings: Array<{
      clan: {
        tag: string;
        participants: WarParticipant[];
      }
    }>;
  }>;
}
