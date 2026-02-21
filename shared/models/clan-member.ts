// These models are a direct mapping of what's found in the response
// payloads from the Clash Royale API.
//
// See https://developer.clashroyale.com/#/documentation for more.
//

export interface ClanResult {
  currentMemberCount: number;
  allMembers: ClanMember[];
  lastSnapshotTime?: Date;
  dataWindowMs: number; // The time between last fetch and oldest snapshot.
}

export interface ClanMember {
  // Fields coming directly from the API
  tag: string;
  name: string;
  role: string;
  lastSeen: string;
  expLevel: number;
  trophies: number;
  donations: number;
  donationEval: Eval;
  arena: {
    id: number;
    name: string;
  };
  currentWar?: WarParticipant;
  lastWar?: WarParticipant;
  lastLastWar?: WarParticipant;

  // Derivative fields
  shouldKick: boolean;
  shouldNudge: boolean;
  lastSeenParsed: Date;
  roleCode: string;
  joinCount: number;
  mostRecentJoinTimestamp: Date;
  earliestMembershipTimestamp: Date;
  newlyJoined: boolean;
  historical: boolean;

  // Fields set with human input
  kickCount: number;
  knowInRealLife: boolean;

  // Fields set for historical members
  // e.g. historical=true
  snapshotTimestamp?: Date;
}

export interface WarParticipant {
  tag: string;
  name: string;
  fame: number;
  repairPoints: number;
  boatAttacks: number;
  decksUsed: number;
  decksUsedToday: number;
  warEval: Eval;
  warDaysActive: number;
}

export interface ClanSnapshot {
  id?: string; // Firestore document ID
  clanTag: string;
  timestamp: Date;
  members: ClanMember[];
}

export enum Eval {
  GOOD = 0,
  BAD = 1,
  NEUTRAL = 2,
  NOT_APPLICABLE = 3
}
