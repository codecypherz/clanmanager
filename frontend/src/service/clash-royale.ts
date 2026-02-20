import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ClanMember, ClanResult, ClanSnapshot, Eval, WarParticipant } from '@clan-manager/shared';
import { environment } from '../environments/environment';
import { map } from 'rxjs/operators';
import { SnapshotService } from './snapshot-service';

// The endpoints invoked by this service and the responses mapped come
// directly from the service defitions of the Clash Royale API.
//
// See https://developer.clashroyale.com/#/documentation for more info.
//

@Injectable({
  providedIn: 'root'
})
export class ClashRoyaleService {

  // Reset is at 10am UTC which is 5am EST.
  private readonly CLAN_WAR_RESET_HOUR_UTC: number = 10;

  private readonly LAST_SEEN_GACE_PERIOD_MS = 1000 * 60 * 60 * 24 * 2.5; // 2.5 days
  private readonly API_KEY = import.meta.env.NG_APP_CLASH_API_KEY;

  private baseUrl = environment.baseClashRoyaleApiUrl;

  constructor(
    private http: HttpClient,
    private snapshotService: SnapshotService) { }

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
        const isWarDay = this.isWarDay();
        console.log("War day", isWarDay);
        const currentParticipants = this.getWarParticipants(clanTag, 0, isWarDay, currentWar, warLog);
        const lastWarParticipants = this.getWarParticipants(clanTag, 1, isWarDay, currentWar, warLog);
        const lastLastWarParticipants = this.getWarParticipants(clanTag, 2, isWarDay, currentWar, warLog);

        // Join the data
        const currentMembers: ClanMember[] = members.memberList.map(member => ({
          ...member,
          roleCode: this.getRoleCode(member.role),
          currentWar: this.findWarParticipant(member, currentParticipants),
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
          member.newlyJoined = this.isNewlyJoined(member);
          member.donationEval = this.evaluateDonations(member);
          member.shouldKick = this.shouldKick(member);
          member.shouldNudge = this.shouldNudge(member);
        }

        // Save the newly fetched data.
        // Calling "subscribe" ensures the Observable is invoked.
        this.snapshotService.saveSnapshot(clanTag, currentMembers, allSnapshots).subscribe();

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

  private getWarParticipants(
      clanTag: string,
      weekOffset: number,
      isWarDay: boolean,
      currentWar: CurrentRiverRaceResponse,
      warLog: RiverRaceLogResponse): WarParticipant[] {
    
    // Special case for active war
    if (weekOffset == 0 && isWarDay) {
      return currentWar.clan.participants;
    }

    // If it's not war day, use the weekOffset to access the warLog (e.g. 0, 1, 2).
    // If it is war day, then the weekOffset will be 1 or higher. Subtract one to index.
    const index = !isWarDay ? weekOffset : weekOffset - 1;
    const warStandings = warLog.items[index]?.standings.find(s => s.clan.tag === clanTag);
    return warStandings?.clan.participants || [];
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
    let now = new Date();
    if ([5, 6, 0].includes(now.getUTCDay())) {
      // It's a war day if it's Friday, Saturday, or Sunday
      return true;
    }
    if (now.getUTCDay() == 4) {
      // If it's Thursday, it's war day after reset
      return now.getUTCHours() > this.CLAN_WAR_RESET_HOUR_UTC;
    }
    if (now.getUTCDay() == 1) {
      // If it's Monday, it's war day before reset
      return now.getUTCHours() < this.CLAN_WAR_RESET_HOUR_UTC;
    }
    return false;
  }

  private evaluateDonations(member: ClanMember): Eval {
    return member.donations == 0 ? Eval.BAD : Eval.GOOD;
  }

  private shouldKick(member: ClanMember): boolean {
    if (member.historical) {
      return false; // Already not in the clan.
    }

    // Kick if they didn't participate in war.
    let shouldKickForWar = false;
    if (this.shouldKickForWar(member, 0, member.currentWar)) {
      shouldKickForWar = true;
    }
    if (this.shouldKickForWar(member, 1, member.lastWar)) {
      shouldKickForWar = true;
    }
    if (this.shouldKickForWar(member, 2, member.lastLastWar)) {
      shouldKickForWar = true;
    }
    return shouldKickForWar;
  }

  private shouldKickForWar(member: ClanMember, weekOffset: number, war: WarParticipant | undefined): boolean {
    if (war == undefined) {
      return false;
    }

    const now = new Date();
    const warStart = this.getThursdayReset(weekOffset);
    let warEnd = new Date(warStart);
    warEnd.setDate(warStart.getDate() + 4);
    const joinTime = new Date(member.earliestMembershipTimestamp);

    let fame = war.fame || 0;
    let numDaysActiveInWar = this.getNumWarDaysActive(warStart, warEnd, joinTime, now);
    war.warDaysActive = numDaysActiveInWar;

    if (numDaysActiveInWar > 0) {
      let goodFame = numDaysActiveInWar * 400;
      let kickThreshold = (numDaysActiveInWar - 1) * 400;
      if (fame <= kickThreshold) {
        war.warEval = Eval.BAD;
      } else if (fame >= goodFame) {
        war.warEval = Eval.GOOD;
      } else {
        // Between "kick" and "good"
        war.warEval = Eval.NEUTRAL;
      }
      return fame <= kickThreshold;
    }

    // No accountability
    war.warEval = fame == 0 ? Eval.NOT_APPLICABLE : Eval.NEUTRAL;
    return false;
  }

  private getNumWarDaysActive(warStart: Date, warEnd: Date, joinTime: Date, now: Date): number {
    if (joinTime.getTime() > warEnd.getTime()) {
      // The player joined after the war ended, so they are not accountable.
      return 0;
    }

    if (warStart.getTime() > joinTime.getTime()) {
      // The war started after the player joined, so they are accountable.
      return Math.min(this.getDaysBetween(warStart, now), 4);
    }

    if (joinTime.getTime() > warStart.getTime() &&
      joinTime.getTime() < warEnd.getTime()) {
      // The player joined in the middle of the war.
      return Math.min(this.getDaysBetween(joinTime, now), this.getDaysBetween(joinTime, warEnd));
    }

    // Not accountable by default.
    return 0;
  }

  /**
   * @param date1 - The first date
   * @param date2 - The second date
   * @returns The number of full days between the two dates rounded up
   */
  private getDaysBetween(date1: Date, date2: Date): number {
    const diffInMs = Math.abs(date2.getTime() - date1.getTime());
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.ceil(diffInMs / MS_PER_DAY);
  }

  private isNewlyJoined(member: ClanMember): boolean {
    let joinDate = new Date(member.earliestMembershipTimestamp);
    let lastReset = this.getLastReset();
    return joinDate > lastReset;
  }

  private getLastReset(): Date {
    const now = new Date();
    const lastReset = new Date();

    lastReset.setUTCHours(this.CLAN_WAR_RESET_HOUR_UTC, 0, 0, 0);

    // If 10am UTC is in the future, go back to yesterday.
    if (lastReset > now) {
      lastReset.setUTCDate(lastReset.getUTCDate() - 1);
    }
    return lastReset;
  }

  private shouldNudge(member: ClanMember): boolean {
    if (member.historical) {
      return false; // Can't nudge someone that's not there!
    }

    // No nudge logic for now.
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
   * @returns The Thursday of interest set at the reset hour
   */
  private getThursdayReset(weekOffset: number): Date {
    const now = new Date();
    const currentDay = now.getUTCDay();
    const targetDay = 4; // Thursday

    // Calculate days since the most recent Thursday
    let daysSinceRecentThursday = (currentDay - targetDay + 7) % 7;

    const targetDate = new Date(now.getTime());

    // Use the offset to go further back in time
    targetDate.setUTCDate(now.getUTCDate() - daysSinceRecentThursday - (7 * weekOffset));

    // Reset time to the UTC reset hour
    targetDate.setUTCHours(this.CLAN_WAR_RESET_HOUR_UTC, 0, 0, 0);

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
