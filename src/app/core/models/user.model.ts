export interface User {
  userId: number;
  userName: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isOnline: boolean;
  lastSeen?: Date;
  isActive: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: number;
  userName: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  userName: string;
  displayName: string;
  email: string;
  password: string;
}
