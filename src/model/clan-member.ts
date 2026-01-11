export interface ClanMember {
  tag: string;
  name: string;
  role: string;
  lastSeen: string;
  expLevel: number;
  trophies: number;
  arena: {
    id: number;
    name: string;
  };
}

export interface ClanMemberListResponse {
  items: ClanMember[];
}
