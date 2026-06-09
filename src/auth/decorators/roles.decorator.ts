import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Attach required roles to a route or controller, e.g. @Roles(Role.OWNER).
// Read back by RolesGuard via the Reflector.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
