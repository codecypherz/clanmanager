// These models are a direct mapping of what's found in the response
// payloads from the Clash Royale API.
//
// See https://developer.clashroyale.com/#/documentation for more.
//
export interface ClanMember {
  tag: string;
  name: string;
  shouldKick: boolean;
  shouldNudge: boolean;
  role: string;
  roleCode: string;
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
