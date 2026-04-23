import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { SystemService } from '../../services/system.service';
import { Router } from '@angular/router';
import { WebSocketMessage } from '../../models/WebSocketMessage';

export interface AdminProjectMember {
  username: string;
  fullName: string;
  email: string;
  role: string;
}

export interface AdminUserSearchResult {
  username: string;
  fullName?: string;
  email?: string;
  eppn?: string;
  firstName?: string;
  lastName?: string;
}

export interface AdminProject {
  id: number | string;
  name: string;
  archived: boolean;
  created_at?: string;
  members: AdminProjectMember[];
}

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent implements OnInit {

  readonly roleOptions:string[] = ['admin', 'analyzer', 'transcriber', 'member'];

  projects: AdminProject[] = [];
  loading = true;
  error: string = null;
  expandedProjectId: number | string = null;

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
    const session = this.userService.getSession();
    if (!session?.privileges?.sysAdmin) {
      this.router.navigate(['/']);
      return;
    }
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
          username: user.username
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

  async updateMemberRole(project: AdminProject, member: AdminProjectMember, event: Event): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    const selectElement = event.target as HTMLSelectElement;
    const selectedRole = selectElement?.value;
    const previousRole = member.role;

    this.projectActionErrorByProject[projectKey] = null;

    if (!selectedRole || selectedRole === previousRole) {
      return;
    }

    if (previousRole === 'admin' && selectedRole !== 'admin' && this.getAdminCount(project) < 2) {
      this.projectActionErrorByProject[projectKey] = 'A project must always have at least one admin.';
      selectElement.value = previousRole;
      return;
    }

    const memberKey = this.memberActionKey(project.id, member.username);
    this.updatingRoleKeys.add(memberKey);

    try {
      const wsMsg:WebSocketMessage = await this.systemService.sendCommandToBackend({
        cmd: 'adminUpdateProjectMemberRole',
        data: {
          projectId: project.id,
          username: member.username,
          role: selectedRole
        }
      });

      if (wsMsg?.result === false) {
        this.projectActionErrorByProject[projectKey] = wsMsg.message || 'Failed to update member role.';
        selectElement.value = previousRole;
        return;
      }

      await this.fetchProjects(false, true);
    } catch (_error) {
      this.projectActionErrorByProject[projectKey] = 'Could not update role right now.';
      selectElement.value = previousRole;
    } finally {
      this.updatingRoleKeys.delete(memberKey);
    }
  }

  async removeMemberFromProject(project: AdminProject, member: AdminProjectMember): Promise<void> {
    const projectKey = this.projectIdKey(project.id);
    this.projectActionErrorByProject[projectKey] = null;

    if (member.role === 'admin' && this.getAdminCount(project) < 2) {
      this.projectActionErrorByProject[projectKey] = 'Cannot remove the last admin from a project.';
      return;
    }

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

  getAdminCount(project: AdminProject): number {
    return (project.members || []).filter((member) => member.role === 'admin').length;
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
