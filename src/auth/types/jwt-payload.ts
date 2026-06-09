import { Role } from '@prisma/client';

// What we sign into the JWT. `sub` (subject) is the standard claim for the user id.
export interface JwtPayload {
  sub: string; // userId
  businessId: string; // tenant id — drives multi-tenant isolation in Phase 3
  role: Role;
  email: string;
}

// What the JwtStrategy returns and Nest attaches to request.user.
export interface AuthUser {
  userId: string;
  businessId: string;
  role: Role;
  email: string;
}
