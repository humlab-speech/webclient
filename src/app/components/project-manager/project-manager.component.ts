import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { ProjectService } from "../../services/project.service";
import { Project } from "../../models/Project";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ModalService } from "../../services/modal.service";
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-project-manager',
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss']
})
export class ProjectManagerComponent implements OnInit, OnDestroy {

  @Input() dashboard;

  projectsLoaded:boolean = false;
  projects:Project[];
  projectCreateInProgress:boolean = false;
  projectInEdit:Project|null = null;
  showCreateProjectButton:boolean = false;
  forceProjectManagerLoading:boolean = !!environment.PROJECT_MANAGER_FORCE_LOADING;
  loadingStatusMsg:string = "Preparing workspace...";
  activeLoadingStepId:string = "authenticateUser";
  completedLoadingSteps:Set<string> = new Set<string>();
  ghostProjectCards:number[] = [1, 2, 3];

  loadingSteps:{ id: string, label: string }[] = [
    { id: "authenticateUser", label: "Authenticating user" },
    { id: "getSession", label: "Loading session" },
    { id: "fetchProjects", label: "Fetching projects" }
  ];

  private subscriptions:Subscription[] = [];

  constructor(private userService:UserService, private projectService:ProjectService, private http:HttpClient, private modalService: ModalService) {
    this.modalService = modalService;
  }

  ngOnInit():void {
    /*
    window.addEventListener('show-spr-scripts-dialog', () => {
      this.dashboard.modalActive = true;
      this.dashboard.modalName = "spr-scripts-dialog";
    });
    */

    window.addEventListener('show-script-dialog', () => {
      this.dashboard.modalActive = true;
      this.dashboard.modalName = "script-dialog";
    });

    window.addEventListener('hide-script-dialog', () => {
      this.dashboard.modalActive = false;
    });

    window.addEventListener('show-import-audio-dialog', () => {
      this.dashboard.modalActive = true;
      this.dashboard.modalName = "import-audio-dialog";
    });

    window.addEventListener('close-import-audio-dialog', () => {
      this.dashboard.modalActive = false;
    });

    if(this.userService.userAuthenticationCheckPerformed && this.userService.userIsAuthenticated) {
      this.completedLoadingSteps.add("authenticateUser");
    }

    if(this.userService.getSession()) {
      this.completedLoadingSteps.add("getSession");
    }

    if(this.forceProjectManagerLoading) {
      this.loadingStatusMsg = "Debug mode: forced project manager loading state";
      this.activeLoadingStepId = "fetchProjects";
    }

    this.subscriptions.push(this.userService.bootstrapLoadingStatus$.subscribe((status:string) => {
      this.applyLoadingStatus(status);
    }));

    this.subscriptions.push(this.projectService.loadingStatus$.subscribe((status:string) => {
      this.applyLoadingStatus(status);
    }));

    this.subscriptions.push(this.userService.sessionObs.subscribe((session) => {
      if(session?.privileges?.createProjects) {
        this.showCreateProjectButton = true;
      }
    }));

    this.subscriptions.push(this.projectService.projects$.subscribe(projects => {
      this.projects = <Project[]>projects;
      this.projectsLoaded = !this.forceProjectManagerLoading;
      this.completedLoadingSteps.add("fetchProjects");
      this.loadingStatusMsg = this.forceProjectManagerLoading ? "Debug mode: forced project manager loading state" : "Projects ready";
    }));

    this.subscriptions.push(this.userService.eventEmitter.subscribe((event) => {
      if(event == "userAuthorization" && !this.projectsLoaded) {
        this.loadingStatusMsg = "Fetching projects...";
        this.projectService.fetchProjects(true).subscribe(projects => {
        });
      }
    }));

    let userSession = this.userService.getSession();
    if(userSession?.privileges?.createProjects) {
      this.showCreateProjectButton = true;
    }

    // Kick off project loading as soon as authorization is known.
    // ProjectService handles waiting/retrying until a session becomes available.
    if(this.userService.userIsAuthorized && !this.projectsLoaded) {
      this.projectService.fetchProjects(true).subscribe(projects => {});
    }

  }

  ngOnDestroy():void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get sortedProjects():Project[] {
    if(!this.projects || this.projects.length < 2) {
      return this.projects || [];
    }

    return [...this.projects].sort((a:Project, b:Project) => {
      if ((a.archived ? 1 : 0) !== (b.archived ? 1 : 0)) {
        return (a.archived ? 1 : 0) - (b.archived ? 1 : 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  get activeProjectCount():number {
    if(!this.projects) {
      return 0;
    }
    return this.projects.filter((project:Project) => !project.archived).length;
  }

  isLoadingStepComplete(stepId:string):boolean {
    return this.completedLoadingSteps.has(stepId);
  }

  isLoadingStepActive(stepId:string):boolean {
    return this.activeLoadingStepId == stepId;
  }

  shouldShowLoadingState():boolean {
    return this.forceProjectManagerLoading || !this.projectsLoaded;
  }

  private applyLoadingStatus(status:string) {
    if(!status || status == "idle") {
      return;
    }

    const [cmd, state] = status.split(":");

    if(cmd == "authorizeUser") {
      if(state == "start") {
        this.loadingStatusMsg = "Checking access rights...";
      }
      return;
    }

    if(cmd != "authenticateUser" && cmd != "getSession" && cmd != "fetchProjects") {
      return;
    }

    const startMessages = {
      authenticateUser: "Authenticating user...",
      getSession: "Loading user session...",
      fetchProjects: "Fetching projects..."
    };

    const errorMessages = {
      authenticateUser: "Authentication failed.",
      getSession: "Could not load session.",
      fetchProjects: "Could not fetch projects."
    };

    if(state == "start") {
      this.activeLoadingStepId = cmd;
      this.loadingStatusMsg = startMessages[cmd];
      return;
    }

    if(state == "done") {
      this.completedLoadingSteps.add(cmd);
      if(cmd == "fetchProjects" && !this.projectsLoaded) {
        this.loadingStatusMsg = "Finishing project load...";
      }
      return;
    }

    if(state == "error") {
      this.activeLoadingStepId = cmd;
      this.loadingStatusMsg = errorMessages[cmd];
    }
  }

  showTranscribeDialog(project = null) { 
    this.projectInEdit = project;
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'transcribe-dialog';
    this.modalService.showModal('transcribe-dialog');
  }

  showSessionsDialog() {
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'manage-sessions-dialog';
  }

  showManageMembersDialog() {
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'manage-project-members-dialog';
  }

  showManageBundleListsDialog() {
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'manage-bundle-assignment-dialog';
  }

  showProjectDialog(project = null) {
    this.projectInEdit = project;
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'project-dialog';
  }

  showSprScriptsDialog(project = null) {
    this.projectInEdit = project;
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'spr-scripts-dialog';
  }

  showInviteCodesDialog(project = null) {
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'invite-codes-dialog';
  }
}
