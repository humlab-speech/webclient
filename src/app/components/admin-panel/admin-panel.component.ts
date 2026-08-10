import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { SystemService } from '../../services/system.service';
import { Router } from '@angular/router';
import { WebSocketMessage } from '../../models/WebSocketMessage';
import { Role, PROJECT_ROLE_RESEARCHER } from '../../models/Role';

export interface AdminProjectMember {
  username: string;
  fullName: string;
  email: string;
  /** Project role: 'project_admin' | 'researcher'. */
  role?: string;
}

export interface AdminUserSearchResult {
  username: string;
  fullName?: string;
  email?: string;
  eppn?: string;
  firstName?: string;
  lastName?: string;
}

export interface AdminBundleStorageStats {
  name: string;
  size: number;
}

export interface AdminSessionStorageStats {
  name: string;
  bundleCount: number;
  totalSize: number;
  bundles: AdminBundleStorageStats[];
}

export interface AdminProjectStorageStats {
  sessionCount: number;
  bundleCount: number;
  totalSize: number;
  sessions: AdminSessionStorageStats[];
}

export interface AdminProject {
  id: number | string;
  name: string;
  archived: boolean;
  created_at?: string;
  members: AdminProjectMember[];
  storageStats?: AdminProjectStorageStats;
  storageStatsLoading?: boolean;
  storageStatsError?: string;
}

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent implements OnInit {

  projects: AdminProject[] = [];
  loading = true;
  error: string = null;
  expandedProjectId: number | string = null;
  expandedStorageProjectId: number | string = null;

  projectRoles: Role[] = [];
  /** Role to assign to the next member added, per project. */
  newMemberRoleByProject: Record<string, string> = {};

  memberSearchValueByProject: Record<string, string> = {};
  memberSearchResultsByProject: Record<string, AdminUserSearchResult[]> = {};
  memberSearchErrorByProject: Record<string, string> = {};
  projectActionErrorByProject: Record<string, string> = {};

  private archivingProjectIds:Set<string> = new Set();
  private deletingProjectIds:Set<string> = new Set();
  private searchingUsersProjectIds:Set<string> = new Set();
  private addingMemberProjectIds:Set<string> = new Set();
  private removingMemberKeys:Set<string> = new Set();
  private updatingRoleKeys:Set<string> = new Set();

  constructor(
    private userService: UserService,
    private systemService: SystemService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.userService.userIsSysAdmin()) {
      this.router.navigate(['/']);
      return;
    }
    this.userService.fetchProjectRoles().subscribe((roles: Role[]) => {
      this.projectRoles = roles;
    });
    this.fetchProjects(true, false);
  }

  projectIdKey(projectId: number | string): string {
    return String(projectId);
  }

  isMembersEditorOpen(project: AdminProject): boolean {
    return this.expandedProjectId === project.id;
  }

  toggleMembersEditor(project: AdminProject): void {
    if (this.expandedProjectId === project.id) {
      this.expandedProjectId = null;
      this.clearMemberSearchState(project.id);
      return;
    }

    const projectKey = this.projectIdKey(project.id);
    this.expandedProjectId = project.id;
    this.newMemberRoleByProject[projectKey] = PROJECT_ROLE_RESEARCHER;
    this.memberSearchValueByProject[projectKey] = '';
    this.memberSearchResultsByProject[projectKey] = [];
    this.memberSearchErrorByProject[projectKey] = null;
    this.projectActionErrorByProject[projectKey] = null;
  }

  onMemberSearchInput(project: AdminProject, event: Event): void {
    const projectKey = this.projectIdKey(project.id);
    const input = event.target as HTMLInputElement;
    this.memberSearchValueByProject[projectKey] = input?.value || '';
    this.memberSearchErrorByProject[projectKey] = null;
  }

  displayUserName(user: AdminUserSearchResult): string {
    if (user.fullName) {
      return user.fullName;
    }

    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      return fullName;
    }

    return user.username;
  }

  displayUserSecondary(user: AdminUserSearchResult): string {
    return user.email || user.eppn || user.username;
  }

  async searchUsers(project: AdminProject): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    const searchValue = (this.memberSearchValueByProject[projectKey] || '').trim();
    this.projectActionErrorByProject[projectKey] = null;

    if (searchValue.length < 3) {
      this.memberSearchResultsByProject[projectKey] = [];
      this.memberSearchErrorByProject[projectKey] = 'Type at least 3 characters to search.';
      return;
    }

    this.searchingUsersProjectIds.add(projectKey);
    this.memberSearchErrorByProject[projectKey] = null;

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminSearchUsers',
        data: {
          searchValue: searchValue,
          limit: 10
        }
      });

      if (wsMsg?.result === false) {
        this.memberSearchResultsByProject[projectKey] = [];
        this.memberSearchErrorByProject[projectKey] = wsMsg.message || 'User search failed.';
        return;
      }

      const users = Array.isArray(wsMsg?.data?.users)
        ? wsMsg.data.users
        : (Array.isArray(wsMsg?.data?.data) ? wsMsg.data.data : []);

      const existingMembers = new Set((project.members || []).map((member) => member.username));
      this.memberSearchResultsByProject[projectKey] = users.filter((user: AdminUserSearchResult) => !existingMembers.has(user.username));

      if (this.memberSearchResultsByProject[projectKey].length < 1) {
        this.memberSearchErrorByProject[projectKey] = 'No matching users found.';
      }
    } catch (_error) {
      this.memberSearchResultsByProject[projectKey] = [];
      this.memberSearchErrorByProject[projectKey] = 'Could not search users right now.';
    } finally {
      this.searchingUsersProjectIds.delete(projectKey);
    }
  }

  async addMemberToProject(project: AdminProject, user: AdminUserSearchResult): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    this.projectActionErrorByProject[projectKey] = null;
    this.addingMemberProjectIds.add(projectKey);

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminAddProjectMember',
        data: {
          projectId: project.id,
          username: user.username,
          role: this.newMemberRoleByProject[projectKey] || PROJECT_ROLE_RESEARCHER
        }
      });

      if (wsMsg?.result === false) {
        this.projectActionErrorByProject[projectKey] = wsMsg.message || 'Failed to add member.';
        return;
      }

      await this.fetchProjects(false, true);
      this.memberSearchValueByProject[projectKey] = '';
      this.memberSearchResultsByProject[projectKey] = [];
      this.memberSearchErrorByProject[projectKey] = null;
    } catch (_error) {
      this.projectActionErrorByProject[projectKey] = 'Could not add member right now.';
    } finally {
      this.addingMemberProjectIds.delete(projectKey);
    }
  }

  async changeMemberRole(project: AdminProject, member: AdminProjectMember, event: Event): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    const selectEl = event.target as HTMLSelectElement;
    const newRole = selectEl.value;
    const previousRole = member.role;

    if (newRole === previousRole) {
      return;
    }

    this.projectActionErrorByProject[projectKey] = null;
    const memberKey = this.memberActionKey(project.id, member.username);
    this.updatingRoleKeys.add(memberKey);

    // Optimistic, so the select does not snap back while the request is in flight.
    member.role = newRole;

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminUpdateProjectMemberRole',
        data: {
          projectId: project.id,
          username: member.username,
          role: newRole
        }
      });

      if (wsMsg?.result === false) {
        member.role = previousRole;
        selectEl.value = previousRole;
        this.projectActionErrorByProject[projectKey] = wsMsg.message || 'Failed to update member role.';
        return;
      }

      await this.fetchProjects(false, true);
    } catch (_error) {
      member.role = previousRole;
      selectEl.value = previousRole;
      this.projectActionErrorByProject[projectKey] = 'Could not update member role right now.';
    } finally {
      this.updatingRoleKeys.delete(memberKey);
    }
  }

  async removeMemberFromProject(project: AdminProject, member: AdminProjectMember): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    this.projectActionErrorByProject[projectKey] = null;

    const confirmed = window.confirm(`Remove ${member.fullName || member.username} from ${project.name}?`);
    if (!confirmed) {
      return;
    }

    const memberKey = this.memberActionKey(project.id, member.username);
    this.removingMemberKeys.add(memberKey);

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminRemoveProjectMember',
        data: {
          projectId: project.id,
          username: member.username
        }
      });

      if (wsMsg?.result === false) {
        this.projectActionErrorByProject[projectKey] = wsMsg.message || 'Failed to remove member.';
        return;
      }

      await this.fetchProjects(false, true);
    } catch (_error) {
      this.projectActionErrorByProject[projectKey] = 'Could not remove member right now.';
    } finally {
      this.removingMemberKeys.delete(memberKey);
    }
  }

  async toggleProjectArchived(project: AdminProject): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    const setArchived = !project.archived;
    this.projectActionErrorByProject[projectKey] = null;

    if (setArchived) {
      const confirmed = window.confirm(
        `Archive project "${project.name}"?\n\nArchived projects remain visible but locked for normal project operations.`
      );
      if (!confirmed) {
        return;
      }
    }

    this.archivingProjectIds.add(projectKey);

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminSetProjectArchived',
        data: {
          projectId: project.id,
          archived: setArchived
        }
      });

      if (wsMsg?.result === false) {
        this.projectActionErrorByProject[projectKey] = wsMsg.message || 'Failed to update archive state.';
        return;
      }

      await this.fetchProjects(false, true);
    } catch (_error) {
      this.projectActionErrorByProject[projectKey] = 'Could not update archive state right now.';
    } finally {
      this.archivingProjectIds.delete(projectKey);
    }
  }

  async deleteProject(project: AdminProject): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    this.projectActionErrorByProject[projectKey] = null;

    const confirmed = window.confirm(
      `Delete project "${project.name}"?\n\nThis permanently removes the project and associated data.`
    );
    if (!confirmed) {
      return;
    }

    this.deletingProjectIds.add(projectKey);

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminDeleteProject',
        data: {
          projectId: project.id
        }
      });

      if (wsMsg?.result === false) {
        this.projectActionErrorByProject[projectKey] = wsMsg.message || 'Failed to delete project.';
        return;
      }

      if (this.expandedProjectId === project.id) {
        this.expandedProjectId = null;
      }

      await this.fetchProjects(false, true);
    } catch (_error) {
      this.projectActionErrorByProject[projectKey] = 'Could not delete project right now.';
    } finally {
      this.deletingProjectIds.delete(projectKey);
    }
  }

  async fetchProjects(showLoadingState = true, preserveExpandedEditor = false): Promise<void> {
    if (showLoadingState) {
      this.loading = true;
    }
    this.error = null;

    const previouslyExpandedProjectId = preserveExpandedEditor ? this.expandedProjectId : null;

    try {
      const msg:WebSocketMessage = await this.systemService.sendCommandToBackend({ cmd: 'adminFetchAllProjects' });
      if (msg.result) {
        this.projects = msg.data.projects || [];
        this.loadStorageStatsForProjects();
      } else {
        this.error = msg.message || 'Failed to fetch projects.';
      }
    } catch (_error) {
      this.error = 'Could not connect to the backend.';
    } finally {
      if (preserveExpandedEditor && previouslyExpandedProjectId !== null) {
        const hasExpandedProject = this.projects.some((project) => project.id === previouslyExpandedProjectId);
        this.expandedProjectId = hasExpandedProject ? previouslyExpandedProjectId : null;
      }

      if (showLoadingState) {
        this.loading = false;
      }
    }
  }

  // Fired once the initial (fast) project list has rendered. Each project's
  // storage stats require walking its EmuDB directory tree on disk, which is
  // too slow to make the whole panel wait on — so these run as independent,
  // concurrent requests and fill in as they arrive rather than blocking load.
  private loadStorageStatsForProjects(): void {
    for (const project of this.projects) {
      this.fetchStorageStatsForProject(project);
    }
  }

  private async fetchStorageStatsForProject(project: AdminProject): Promise<void> {
    project.storageStatsLoading = true;
    project.storageStatsError = null;

    try {
      const msg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminFetchProjectStorageStats',
        data: { projectId: project.id }
      });

      if (msg.result) {
        project.storageStats = {
          sessionCount: msg.data.sessionCount || 0,
          bundleCount: msg.data.bundleCount || 0,
          totalSize: msg.data.totalSize || 0,
          sessions: msg.data.sessions || []
        };
      } else {
        project.storageStatsError = msg.message || 'Failed to load storage stats.';
      }
    } catch (_error) {
      project.storageStatsError = 'Could not load storage stats.';
    } finally {
      project.storageStatsLoading = false;
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }

  isStorageDetailsOpen(project: AdminProject): boolean {
    return this.expandedStorageProjectId === project.id;
  }

  toggleStorageDetails(project: AdminProject): void {
    this.expandedStorageProjectId = this.isStorageDetailsOpen(project) ? null : project.id;
  }

  isArchivingProject(projectId: number | string): boolean {
    return this.archivingProjectIds.has(this.projectIdKey(projectId));
  }

  isDeletingProject(projectId: number | string): boolean {
    return this.deletingProjectIds.has(this.projectIdKey(projectId));
  }

  isSearchingUsers(projectId: number | string): boolean {
    return this.searchingUsersProjectIds.has(this.projectIdKey(projectId));
  }

  isAddingMember(projectId: number | string): boolean {
    return this.addingMemberProjectIds.has(this.projectIdKey(projectId));
  }

  isRemovingMember(projectId: number | string, username: string): boolean {
    return this.removingMemberKeys.has(this.memberActionKey(projectId, username));
  }

  isUpdatingMemberRole(projectId: number | string, username: string): boolean {
    return this.updatingRoleKeys.has(this.memberActionKey(projectId, username));
  }

  roleLabel(roleName: string): string {
    return this.projectRoles.find(role => role.name === roleName)?.label || roleName || '-';
  }

  private memberActionKey(projectId: number | string, username: string): string {
    return `${this.projectIdKey(projectId)}:${username}`;
  }

  private clearMemberSearchState(projectId: number | string): void {
    const projectKey = this.projectIdKey(projectId);
    this.memberSearchValueByProject[projectKey] = '';
    this.memberSearchResultsByProject[projectKey] = [];
    this.memberSearchErrorByProject[projectKey] = null;
  }

  get activeProjectCount(): number {
    return this.projects.filter(p => !p.archived).length;
  }

}
