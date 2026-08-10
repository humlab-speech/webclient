/** A role definition, from either the `system_roles` or `project_roles` collection. */
export interface Role {
  name: string;
  label: string;
  /** Project roles only: whether an invite code may grant this role. */
  grantableViaInviteCode?: boolean;
}

export const SYSTEM_ROLE_SYS_ADMIN = 'sys_admin';
export const SYSTEM_ROLE_USER = 'user';

export const PROJECT_ROLE_PROJECT_ADMIN = 'project_admin';
export const PROJECT_ROLE_RESEARCHER = 'researcher';
