export type UserRow = {
  id?: number;
  localId: string;
  email: string;
  name: string;
  createdDate: string;
  latestAccessDate: string;
  latestRole: string;
  description?: string;
  isEdited?: boolean;
};
