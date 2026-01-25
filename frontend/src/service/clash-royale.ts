import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ClanMember, ClanResult, ClanSnapshot, WarParticipant } from '../model/clan-member';
import { environment } from '../environments/environment';
import { map } from 'rxjs/operators';
import { SnapshotService } from './snapshot-service';
import { KickCountService } from './kick-count-service';
import { TestService } from './test-service';

// The endpoints invoked by this service and the responses mapped come
// directly from the service defitions of the Clash Royale API.
//
// See https://developer.clashroyale.com/#/documentation for more info.
//

@Injectable({
  providedIn: 'root'
})
export class ClashRoyaleService {

  private readonly NEW_JOIN_GRACE_PERIOD_MS = 1000 * 60 * 60 * 24; // 24 hours
  private readonly WAR_GRACE_PERIOD_MS = 1000 * 60 * 60 * 24; // 24 hours
  private readonly LAST_SEEN_GACE_PERIOD_MS = 1000 * 60 * 60 * 24 * 2.5; // 2.5 days
  private readonly API_KEY = import.meta.env.NG_APP_CLASH_API_KEY;

  private baseUrl = environment.baseClashRoyaleApiUrl;

  constructor(
    private http: HttpClient,
    private snapshotService: SnapshotService,
    private kickCountService: KickCountService,
    private testService: TestService) { }

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
        const currentMembers: ClanMember[] = members.memberList.map(member => ({
          ...member,
          roleCode: this.getRoleCode(member.role),
          currentWar: this.isWarDay() ? this.findWarParticipant(member, currentParticipants) : undefined,
          lastWar: this.findWarParticipant(member, lastWarParticipants),
          lastLastWar: this.findWarParticipant(member, lastLastWarParticipants),
          historical: false,
          // After all the data is collected, perform additional derivative calculations
        }));

        const historicalMembers: ClanMember[] = this.getHistoricalMembers(currentMembers, allSnapshots);

        // Make some additional calculations for all current and historical members.
        const allMembers: ClanMember[] = currentMembers.concat(historicalMembers);
        for (const member of allMembers) {
          this.setHistoricalMembershipData(member, allSnapshots);
          member.lastSeenParsed = this.parseLastSeen(member.lastSeen);
          member.newlyJoined = this.getTimeSinceJoin(member) < this.NEW_JOIN_GRACE_PERIOD_MS;
          member.kickCount = this.kickCountService.getKickCount(member.tag);
          member.shouldKick = this.shouldKick(member);
          member.shouldNudge = this.shouldNudge(member);
        }

        // Save the newly fetched data.
        // Calling "subscribe" ensures the Observable is invoked.
        this.snapshotService.saveSnapshot(clanTag, currentMembers).subscribe();

        // Return the final ClanResult.
        return {
          currentMemberCount: currentMembers.length,
          allMembers: allMembers,
          lastSnapshotTime: this.getLastSnapshotTime(allSnapshots),
          dataWindowMs: this.calculateDataWindow(allSnapshots)
        };
      })
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.API_KEY}`
    });
  }

  private getLastSnapshotTime(allSnapshots: ClanSnapshot[]): Date | undefined {
    return allSnapshots.length > 0 ? new Date(allSnapshots[0].timestamp) : undefined;
  }

  private calculateDataWindow(allSnapshots: ClanSnapshot[]): number {
    if (allSnapshots.length == 0) {
      return 0;
    }
    const now = new Date();
    const oldestSnapshot = allSnapshots[allSnapshots.length - 1];
    const oldestTime = new Date(oldestSnapshot.timestamp);
    return now.getTime() - oldestTime.getTime();
  }

  private getRoleCode(role: string): string {
    switch (role) {
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

  private parseLastSeen(apiLastSeen: string): Date {
    const parsed = apiLastSeen.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
      '$1-$2-$3T$4:$5:$6'
    );
    return new Date(parsed);
  }

  private findWarParticipant(member: ClanMember, warParticipants: WarParticipant[]): WarParticipant | undefined {
    return warParticipants.find(p => p.tag === member.tag);
  }

  private isWarDay(): boolean {
    // Thursday == 4
    // Sunday == 0
    return [4, 5, 6, 0].includes(new Date().getDay());
  }

  private shouldKick(member: ClanMember): boolean {
    if (member.historical) {
      return false; // Already not in the clan.
    }

    // Give new players a grace period.
    const timeSinceJoin = Date.now() - new Date(member.earliestMembershipTimestamp).getTime();
    if (timeSinceJoin < this.NEW_JOIN_GRACE_PERIOD_MS) {
      return false;
    }

    // Kick if they didn't participate in war.
    if (this.shouldKickForWar(member, 0, member.currentWar)) {
      return true;
    }
    if (this.shouldKickForWar(member, 1, member.lastWar)) {
      return true;
    }
    if (this.shouldKickForWar(member, 2, member.lastLastWar)) {
      return true;
    }

    // Don't kick by default.
    return false;
  }

  private shouldKickForWar(member: ClanMember, weekOffset: number, war: WarParticipant | undefined): boolean {
    if (war == undefined) {
      return false;
    }

    const now = new Date();
    const warStart = this.getThursday(weekOffset);
    let warEnd = new Date(warStart);
    warEnd.setDate(warStart.getDate() + 4);
    const joinTime = new Date(member.earliestMembershipTimestamp);

    if (this.isAccountableForWar(warStart, warEnd, joinTime)) {
      let fame = war?.fame || 0;
      if (weekOffset == 0 && now.getDay() == 5) {
        // If only 1 day of the war has passed (it's Friday), then kick for zero
        return fame == 0;
      }
      return fame <= 400;
    }

    return false;
  }

  private isAccountableForWar(warStart: Date, warEnd: Date, joinTime: Date): boolean {
    const now = new Date();
    if ((now.getTime() - warStart.getTime()) < this.WAR_GRACE_PERIOD_MS) {
      // No one is accountable within the war start grace period.
      // This effectively only applies to the active war.
      return false;
    }

    if (joinTime.getTime() > warEnd.getTime()) {
      // The player joined after the war ended, so they are not accountable.
      return false;
    }

    if (warStart.getTime() > joinTime.getTime()) {
      // The war started after the player joined, so they are accountable.
      return true;
    }

    if (joinTime.getTime() > warStart.getTime() &&
      joinTime.getTime() < warEnd.getTime()) {
      // The player joined in the middle of the war.
      // They are accountable if they had enough time to participate.
      if (warEnd.getTime() - joinTime.getTime() > this.WAR_GRACE_PERIOD_MS) {
        return true;
      }
    }

    // Not accountable by default.
    return false;
  }

  /**
   * @param member The member to check
   * @returns The duration, in milliseconds, since join detected
   */
  private getTimeSinceJoin(member: ClanMember): number {
    return Date.now() - new Date(member.earliestMembershipTimestamp).getTime();
  }

  private shouldNudge(member: ClanMember): boolean {
    if (member.historical) {
      return false; // Can't nudge someone that's not there!
    }

    // Nudge people who have been inactive for a bit.
    const now = new Date();
    const lastSeen = member.lastSeenParsed;
    const diff = now.getTime() - lastSeen.getTime();
    if (diff > this.LAST_SEEN_GACE_PERIOD_MS) {
      return true;
    }

    // Only suggest nudges if it's Thursday, Friday, Saturday, or Sunday
    // if ([4, 5, 6, 0].includes(new Date().getDay())) {
    //   const decksUsedToday = member.currentWar?.decksUsedToday || 0;
    //   return decksUsedToday == 0;
    // }
    return false;
  }

  private setHistoricalMembershipData(member: ClanMember, allSnapshots: ClanSnapshot[]) {
    // Default timestamp for all cases.
    var earliestMembershipTimestamp = new Date();

    if (allSnapshots.length == 0) {
      // No history, therefore the member is current.
      member.joinCount = 1;
      member.earliestMembershipTimestamp = earliestMembershipTimestamp;
      return;
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

      // Keep the oldest timestamp for which we detected membership as the join time.
      if (isMember) {
        earliestMembershipTimestamp = new Date(snapshot.timestamp);
      }

      // Now determine if join count should be incremented.
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

    member.joinCount = joinCount;
    member.earliestMembershipTimestamp = earliestMembershipTimestamp;
  }

  private isMember(tag: string, snapshot: ClanSnapshot): boolean {
    for (const member of snapshot.members) {
      if (member.tag == tag) {
        return true;
      }
    }
    return false;
  }

  private getHistoricalMembers(currentMembers: ClanMember[], allSnapshots: ClanSnapshot[]): ClanMember[] {
    // Get the set of player IDs that are currently in the clan.
    const currentIds = new Set<string>();
    for (const currentMember of currentMembers) {
      currentIds.add(currentMember.tag);
    }

    const historicalMembers: ClanMember[] = [];
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

  /**
   * @param weekOffset 0 for this week, 1 for last week, 2 for last last week
   * @returns The Thursday of interest
   */
  private getThursday(weekOffset: number): Date {
    const now = new Date();
    const currentDay = now.getDay();
    const targetDay = 4; // Thursday

    // Calculate days since the most recent Thursday
    let daysSinceRecentThursday = (currentDay - targetDay) % 7;

    const targetDate = new Date(now);

    // Use the offset to go further back in time
    targetDate.setDate(now.getDate() - daysSinceRecentThursday - (7 * weekOffset));

    // Reset time to the beginning of the day
    targetDate.setHours(0, 0, 0, 0);

    return targetDate;
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
