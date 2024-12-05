import { Component, Input, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { ProjectService } from "../../services/project.service";
import { Project } from "../../models/Project";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ModalService } from "../../services/modal.service";

@Component({
  selector: 'app-project-manager',
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss']
})
export class ProjectManagerComponent implements OnInit {

  @Input() dashboard;

  projectsLoaded:boolean = false;
  projects:Project[];
  projectCreateInProgress:boolean = false;
  projectInEdit:Project|null = null;
  showCreateProjectButton:boolean = false;

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

    this.projectService.projects$.subscribe(projects => {
      this.projects = <Project[]>projects;
      this.projectsLoaded = true;
    });

    this.userService.eventEmitter.subscribe((event) => {
      if(event == "userAuthorization" && !this.projectsLoaded) {
        this.projectService.fetchProjects(true).subscribe(projects => {
        });
      }
    });

    let userSession = this.userService.getSession();
    if(userSession) {
      if(userSession.privileges.createProjects) {
        this.showCreateProjectButton = true;
      }
      this.projectService.fetchProjects(true).subscribe(projects => {});
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
