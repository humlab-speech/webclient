/**
 * An invite code always invites someone into exactly one project, as exactly one
 * project role. It may optionally be locked to a single EPPN (the SWAMID unique
 * identifier), in which case only that identity can redeem it.
 */
export interface InviteCode {
    code: string;
    projectId: string;
    role: string;
    eppn?: string | null;
    used: boolean;
    usedDate?: string;
    createdBy?: string;
    created?: string;
}
