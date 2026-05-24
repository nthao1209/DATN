export const ROLE_IDS = {
  SYSTEM_ADMIN: 1,
  ADMIN: 2,
  BUS_MANAGEMENT: 3,
} as const;

export type RoleId = (typeof ROLE_IDS)[keyof typeof ROLE_IDS];

const KNOWN_ROLE_IDS: readonly RoleId[] = [
  ROLE_IDS.SYSTEM_ADMIN,
  ROLE_IDS.ADMIN,
  ROLE_IDS.BUS_MANAGEMENT,
];

export const ROLE_NAMES: Record<RoleId, string> = {
  [ROLE_IDS.SYSTEM_ADMIN]: 'System Super Admin',
  [ROLE_IDS.ADMIN]: 'Admin',
  [ROLE_IDS.BUS_MANAGEMENT]: 'BusManagement',
};

export const isRoleId = (value: unknown): value is RoleId =>
  typeof value === 'number' && KNOWN_ROLE_IDS.includes(value as RoleId);

export const resolveRoleId = (
  ...roleIds: Array<number | null | undefined>
): RoleId | undefined => roleIds.find(isRoleId);