import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ClanMember, ClanResult, ClanSnapshot, WarParticipant } from '../model/clan-member';
import { environment } from '../environments/environment';
import { map } from 'rxjs/operators';
import { SnapshotService } from './snapshot-service';

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

  constructor(
    private http: HttpClient,
    private snapshotService: SnapshotService) {}

  getClanMembers(clanTag: string): Observable<ClanResult> {
    // Clan tags in the URL must be URL-encoded (replace # with %23)
    const encodedTag = encodeURIComponent(clanTag);
    const url = `${this.baseUrl}/clans/${encodedTag}/members`;
    const headers = this.getHeaders();

    // Fetch all the data in parallel
    return forkJoin({
      members: this.http.get<ClanResponse>(`${this.baseUrl}/clans/${encodedTag}`, { headers: this.getHeaders() }),
      currentWar: this.http.get<CurrentRiverRaceResponse>(`${this.baseUrl}/clans/${encodedTag}/currentriverrace`, { headers: this.getHeaders() }),
      warLog: this.http.get<RiverRaceLogResponse>(`${this.baseUrl}/clans/${encodedTag}/riverracelog`, { headers: this.getHeaders() }),
      allSnapshots: this.snapshotService.getSnapshotHistory(clanTag)
    }).pipe(
      // Join all the data once it's all available
      map(({ members, currentWar, warLog, allSnapshots }) => {
        // Find our clan's specific entry in the last completed war log
        const lastWarStandings = warLog.items[0]?.standings.find(s => s.clan.tag === clanTag);
        const lastWarParticipants = lastWarStandings?.clan.participants || [];

        const lastLastWarStandings = warLog.items[1]?.standings.find(s => s.clan.tag === clanTag);
        const lastLastWarParticipants = lastLastWarStandings?.clan.participants || [];
        
        const currentParticipants = currentWar.clan.participants;

        // Join the data
        const currentMembers : ClanMember[] = members.memberList.map(member => ({
          ...member,
          roleCode: this.getRoleCode(member.role),
          currentWar: currentParticipants.find(p => p.tag === member.tag),
          lastWar: lastWarParticipants.find(p => p.tag === member.tag),
          lastLastWar: lastLastWarParticipants.find(p => p.tag === member.tag),
          historical: false,
        // After all the data is collected, perform additional derivative calculations
        })).map(member => ({
          ...member,
          shouldKick: this.shouldKick(member),
          shouldNudge: this.shouldNudge(member),
        }));

        const historicalMembers : ClanMember[] = this.getHistoricalMembers(currentMembers, allSnapshots);

        // Make some additional calculations for all current and historical members.
        const allMembers: ClanMember[] = currentMembers.concat(historicalMembers);
        for (const member of allMembers) {
          member.joinCount = this.computeJoinCount(member, allSnapshots);
        }

        // Save the newly fetched data.
        // Calling "subscribe" ensures the Observable is invoked.
        this.snapshotService.saveSnapshot(clanTag, currentMembers).subscribe();

        // Return the final ClanResult.
        return {
          currentMemberCount: currentMembers.length,
          allMembers: allMembers
        };
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

  shouldKick(member: ClanMember): boolean {
    // Kick people who aren't doing the current or past wars.
    if ([5, 6, 0].includes(new Date().getDay())) {
      return member.currentWar?.fame == 0;
    }
    return member.lastWar?.fame == 0 || member.lastLastWar?.fame == 0;
  }

  shouldNudge(member: ClanMember): boolean {
    // Only suggest nudges if it's Thursday, Friday, Saturday, or Sunday
    // if ([4, 5, 6, 0].includes(new Date().getDay())) {
    //   const decksUsedToday = member.currentWar?.decksUsedToday || 0;
    //   return decksUsedToday == 0;
    // }
    return false;
  }

  computeJoinCount(member: ClanMember, allSnapshots: ClanSnapshot[]): number {
    if (allSnapshots.length == 0) {
      // No history, therefore the member is current.
      return 1;
    }
    // Default for current members
    var joinCount = 1;
    var lastIsMember = true;
    // Default for historical members
    if (member.historical) {
      joinCount = 0;
      lastIsMember = false;
    }
    
    // This walks backward in time.
    for (const snapshot of allSnapshots) {
      var isMember = this.isMember(member.tag, snapshot);
      if (lastIsMember == isMember) {
        // No change detected
        continue;
      }
      if (!lastIsMember && isMember) {
        // Detected a previous join
        joinCount++;
      }
      lastIsMember = isMember;
    }
    return joinCount;
  }

  isMember(tag: string, snapshot: ClanSnapshot): boolean {
    for (const member of snapshot.members) {
      if (member.tag == tag) {
        return true;
      }
    }
    return false;
  }

  getHistoricalMembers(currentMembers: ClanMember[], allSnapshots: ClanSnapshot[]): ClanMember[] {
    // Get the set of player IDs that are currently in the clan.
    const currentIds = new Set<string>();
    for (const currentMember of currentMembers) {
      currentIds.add(currentMember.tag);
    }

    const historicalMembers : ClanMember[] = [];
    const historicalIds = new Set<string>();

    // The first snapshot is the most recent.
    // Iteration goes further back in time.
    for (const snapshot of allSnapshots) {
      for (const snapshotMember of snapshot.members) {
        const playerId = snapshotMember.tag;
        if (currentIds.has(playerId)) {
          // Skip any player that is a current member.
          // They aren't historical in that case.
          continue;
        }
        if (historicalIds.has(playerId)) {
          // Already have seen this player ID in a more recent snapshot, so skip.
          continue;
        }
        // This is the most recent version of this historical member.
        var historicalMember = snapshotMember;
        historicalMember.historical = true;
        historicalMember.snapshotTimestamp = snapshot.timestamp;
        historicalMembers.push(historicalMember);
        historicalIds.add(playerId);
      }
    }

    return historicalMembers;
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
