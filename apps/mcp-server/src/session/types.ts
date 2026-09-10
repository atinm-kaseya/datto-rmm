export interface SessionState {
  loadedGroups: string[];
  platform: string;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number; // unix ms
}
