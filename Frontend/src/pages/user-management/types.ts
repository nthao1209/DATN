export type UserRow = {
  id?: number;
  localId: string;
  email: string;
  name: string;
  createdDate: string;
  latestAccessDate: string;
  latestRole: string;
  description?: string;
  roleId?: number | null;
  tenantId?: number | null;
  isEdited?: boolean;
};
