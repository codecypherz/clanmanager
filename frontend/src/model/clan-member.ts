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
  earliestMembershipTimestamp: Date;
  newlyJoined: boolean;
  historical: boolean;

  // Fields set with human input
  kickCount: number;

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
}

export interface ClanSnapshot {
  clanTag: string;
  timestamp: Date;
  members: ClanMember[];
}
