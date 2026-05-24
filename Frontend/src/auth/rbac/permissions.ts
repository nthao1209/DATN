import { ROLE_IDS, type RoleId } from './roles';

export const ROLE_HOME_PATHS: Record<RoleId, string> = {
  [ROLE_IDS.SYSTEM_ADMIN]: '/users',
  [ROLE_IDS.ADMIN]: '/dashboard',
  [ROLE_IDS.BUS_MANAGEMENT]: '/transactions',
};

export function hasRoleAccess(
  roleId: number | null | undefined,
  allowedRoles: readonly RoleId[],
) {
  return roleId !== null && roleId !== undefined && allowedRoles.includes(roleId as RoleId);
}

export function getFallbackPathForRole(roleId?: number | null) {
  if (roleId === ROLE_IDS.SYSTEM_ADMIN) {
    return ROLE_HOME_PATHS[ROLE_IDS.SYSTEM_ADMIN];
  }

  if (roleId === ROLE_IDS.ADMIN) {
    return ROLE_HOME_PATHS[ROLE_IDS.ADMIN];
  }

  if (roleId === ROLE_IDS.BUS_MANAGEMENT) {
    return ROLE_HOME_PATHS[ROLE_IDS.BUS_MANAGEMENT];
  }

  return '/login';
}

export function canViewJoinCode(roleId?: number | null) {
  return roleId === ROLE_IDS.SYSTEM_ADMIN || roleId === ROLE_IDS.ADMIN;
}