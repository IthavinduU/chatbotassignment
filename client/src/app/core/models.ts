export type Role = 'user' | 'groupAdmin' | 'superAdmin';
export type Theme = 'blue' | 'red' | 'yellow';
export const THEMES: Theme[] = ['blue', 'red', 'yellow'];

export const ROLE_LABELS: Record<Role, string> = {
  user: 'Member',
  groupAdmin: 'Group admin',
  superAdmin: 'Super admin',
};

export interface User {
  _id: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  email?: string;
  birthdate?: string;
  hardBanned?: boolean;
  hardBanReason?: string | null;
  hardBannedAt?: string;
  createdAt?: string;
}

export interface Channel {
  _id: string;
  groupId: string;
  name: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface Group {
  _id: string;
  name: string;
  theme: Theme;
  ageLimit: number | null;
  adminIds: string[];
  memberIds: string[];
  pastMemberIds: string[];
  bannedIds: string[];
  createdAt: string;
  channels: Channel[];
}

export type DiscoverStatus = 'member' | 'pending' | 'banned' | 'tooYoung' | 'none';

export interface DiscoverGroup {
  _id: string;
  name: string;
  theme: Theme;
  ageLimit: number | null;
  memberCount: number;
  status: DiscoverStatus;
}

export interface Member extends User {
  isAdmin: boolean;
  status?: 'current' | 'past' | 'banned';
}

export interface Members {
  current: Member[];
  history?: Member[];
}

export interface Message {
  _id: string;
  channelId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export type RequestType =
  | 'joinGroup' | 'leaveGroup' | 'createChannel' | 'deleteChannel'
  | 'createGroup' | 'deleteGroup' | 'promoteMember';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ChatRequest {
  _id: string;
  type: RequestType;
  status: RequestStatus;
  requesterId: string;
  requesterName: string;
  groupId?: string;
  groupName?: string;
  channelId?: string;
  channelName?: string;
  targetUserId?: string;
  targetName?: string;
  name?: string;
  ageLimit?: number | null;
  reason: string | null;
  createdAt: string;
  handledByName?: string;
  handledAt?: string;
}

export const REQUEST_LABELS: Record<RequestType, string> = {
  joinGroup: 'Join group',
  leaveGroup: 'Leave group',
  createChannel: 'New chatroom',
  deleteChannel: 'Delete chatroom',
  createGroup: 'New group',
  deleteGroup: 'Delete group',
  promoteMember: 'Promote member',
};

/** One-line summary of what a request asks for. */
export function describeRequest(r: ChatRequest): string {
  switch (r.type) {
    case 'joinGroup': return `${r.requesterName} wants to join ${r.groupName}`;
    case 'leaveGroup': return `${r.requesterName} wants to leave ${r.groupName}`;
    case 'createChannel': return `${r.requesterName} wants a #${r.name} chatroom in ${r.groupName}`;
    case 'deleteChannel': return `${r.requesterName} wants #${r.channelName} in ${r.groupName} deleted`;
    case 'createGroup': return `${r.requesterName} wants a new group called "${r.name}"${r.ageLimit ? ` (age ${r.ageLimit}+)` : ''}`;
    case 'deleteGroup': return `${r.requesterName} wants ${r.groupName} deleted`;
    case 'promoteMember': return `${r.requesterName} wants ${r.targetName} made an admin of ${r.groupName}`;
  }
}

export interface AuditEntry {
  _id: string;
  type: string;
  actorName: string;
  groupId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}