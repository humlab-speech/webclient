import { Component, OnInit, Input, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Project } from '../../models/Project';
import { ProjectService } from '../../services/project.service';
import { VispApp } from "../../models/VispApp";
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { SystemService } from 'src/app/services/system.service';
import { environment } from 'src/environments/environment';
import { NotifierService } from 'angular-notifier';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-project-item',
  templateUrl: './project-item.component.html',
  styleUrls: ['./project-item.component.scss']
})
export class ProjectItemComponent implements OnInit {
  
  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();

  @Input() project: Project;
  @Input() projectManager: ProjectManagerComponent;

  enabledApps = environment.ENABLED_APPLICATIONS;

  statusMsg:string = "";
  domain:string = window.location.hostname;
  projectMenuVisible:boolean = false;
  deleteProjectInProgress:boolean = false;
  archiveProjectInProgress:boolean = false;
  menuTimeout:any;
  members:[];
  projectMembersUrl:string = "";

  vispApplications:VispApp[] = [];
  projectOperations:object[] = [];

  constructor(private http:HttpClient, private projectService:ProjectService, private systemService:SystemService, private notifierService:NotifierService, private userService:UserService) {}

  ngOnInit(): void {
    
    this.projectMembersUrl = window.location.protocol+"//gitlab."+window.location.host+"/"+this.project.path_with_namespace+"/-/project_members";

    this.projectOperations.push({
      title: "Edit emuDB",
      callback: this.showImportAudioDialog
    });


    let sess = this.userService.getSession();
    let projects = this.projectService.getProjects();
    let projectMember = projects.find(project => project.id == this.project.id).members.find(member => member.eppn == sess.eppn);

    environment.ENABLED_APPLICATIONS.forEach((vispAppName) => {
      if(vispAppName == "artic") {
        let emuWebApp = new VispApp();
        emuWebApp.name = "artic";
        emuWebApp.title = "Artic";
        emuWebApp.subtitle = "Annotation tool";
        emuWebApp.icon = "app-icons/88x88-color/emuwebapp-icon.png";
        emuWebApp.disabled = this.shouldAppBeDisabled(emuWebApp.name);
        this.vispApplications.push(emuWebApp);
      }
      if(vispAppName == "jupyter") {
        let jupyterApp = new VispApp();
        jupyterApp.name = "jupyter";
        jupyterApp.title = "Jupyter Notebook";
        jupyterApp.subtitle = "Run code in your project using EmuR";
        jupyterApp.icon = "app-icons/88x88-color/jupyter-icon.png";
        jupyterApp.disabled = this.shouldAppBeDisabled(jupyterApp.name);
        
        if(projectMember.role == "admin" || projectMember.role == "analyzer") {
          this.vispApplications.push(jupyterApp);
        }
      }
      if(vispAppName == "octra") {
        let octraApp = new VispApp();
        octraApp.name = "octra";
        octraApp.title = "Octra";
        octraApp.subtitle = "Transcription tool";
        octraApp.icon = "app-icons/88x88-color/octra-icon.png";
        this.vispApplications.push(octraApp);
      }
      if(vispAppName == "script") {
        let scriptApp = new VispApp();
        scriptApp.name = "script";
        scriptApp.title = "Scripts";
        scriptApp.icon = "app-icons/88x88-bw/script-icon.png";
        //this.vispApplications.push(scriptApp);
      }
      if(vispAppName == "vscode") {
        let vscodeApp = new VispApp();
        vscodeApp.name = "vscode";
        vscodeApp.title = "VS Code";
        vscodeApp.icon = "app-icons/88x88-color/vscode-icon.png";
        vscodeApp.disabled = this.shouldAppBeDisabled(vscodeApp.name);

        this.vispApplications.push(vscodeApp);
      }

    });

    this.vispApplications.reverse();
  }

  get isArchived():boolean {
    return this.project?.archived === true;
  }

  getMemberCount():number {
    return this.project?.members?.length || 0;
  }

  getMemberLabel():string {
    return this.getMemberCount() === 1 ? 'member' : 'members';
  }

  getRecordingCount():number {
    if(!this.project?.sessions?.length) {
      return 0;
    }

    let recordings = 0;

    this.project.sessions.forEach((session) => {
      if(session?.files?.length) {
        recordings += session.files.length;
      }
    });

    return recordings;
  }

  transcribeDialog(project) {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'This project is archived and locked.');
      return;
    }
    this.projectManager.projectInEdit = this.project;
    this.projectManager.showTranscribeDialog(project);
  }

  sessionsDialog(project) {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'This project is archived and locked.');
      return;
    }
    this.projectManager.projectInEdit = project; //not sure this is needed
    this.projectManager.showSessionsDialog();
  }

  manageMembers(project) {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'This project is archived and locked.');
      return;
    }
    this.projectManager.projectInEdit = project;
    this.projectManager.showManageMembersDialog();
  }

  manageBundleLists(project) {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'This project is archived and locked.');
      return;
    }
    this.projectManager.projectInEdit = project;
    this.projectManager.showManageBundleListsDialog();
  }

  shouldAppBeDisabled(appName) {
    if(this.isArchived) {
      return true;
    }
    for(let key in this.project.liveAppSessions) {
      let session = this.project.liveAppSessions[key];
      if(session.type == appName && session.username != this.userService.getSession().username) {
        return true;
      }
      if(session.type != appName) {
        return true;
      }
    }

    return false;
  }

  sessionUpdateFromAppCtrlCallback(msg) {
    if(msg.type == "launch") {
      this.vispApplications.forEach(vispApp => {
        if(vispApp.name != msg.app) {
          vispApp.disabled = true;
        }
      });
    }
    if(msg.type == "close") {
      this.vispApplications.forEach(vispApp => {
        vispApp.disabled = false;
      });
    }
    
  }

  showImportAudioDialog() {
    window.dispatchEvent(new Event('show-import-audio-dialog'));
  }

  closeImportAudioDialog() {
    window.dispatchEvent(new Event('close-import-audio-dialog'));
  }

  showProjectMenu(show:boolean = true, useTimer = false) {
    clearTimeout(this.menuTimeout);
    if(useTimer) {
      this.menuTimeout = setTimeout(() => {
        this.projectMenuVisible = show;
      }, 500);
    }
    else {
      this.projectMenuVisible = show;
    }
  }

  editProject(project:Project) {
    window.location.href = project.web_url+"/edit";
  }
  
  editEmuDb(project:Project) {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'This project is archived and locked.');
      return;
    }
    this.projectManager.showProjectDialog(project);
  }

  openSprScriptsDialog(project:Project) {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'This project is archived and locked.');
      return;
    }
    this.projectManager.showSprScriptsDialog(project);
  }

  deleteProject() {
    if(this.isArchived) {
      this.notifierService.notify('warning', 'Archived projects are locked. Unarchive before deleting.');
      return;
    }
    if(window.confirm('Are sure you want to delete this project? All data associated with this project will be lost.')){
      this.deleteProjectInProgress = true;
      this.projectService.deleteProject(this.project).subscribe(() => {
        this.notifierService.notify("info", "Project '"+this.project.name+"' deleted");
        this.projectService.fetchProjects(true).subscribe();
      });
    }
  }

  archiveProject() {
    if(this.isArchived) {
      return;
    }

    const confirmArchive = window.confirm(
      "Archive this project?\n\nArchived projects are moved to the bottom of the list, shown in a minimal locked view, and all editing/session launch actions are blocked until you unarchive."
    );
    if(!confirmArchive) {
      return;
    }

    this.archiveProjectInProgress = true;
    this.projectService.setProjectArchived(this.project, true).subscribe({
      next: (response:any) => {
        this.archiveProjectInProgress = false;
        if(response?.result === false || response?.data?.result === false) {
          return;
        }
        this.notifierService.notify("info", "Project '"+this.project.name+"' archived");
        this.projectService.fetchProjects(true).subscribe();
      },
      error: () => {
        this.archiveProjectInProgress = false;
      }
    });
  }

  unarchiveProject() {
    if(!this.isArchived) {
      return;
    }

    this.archiveProjectInProgress = true;
    this.projectService.setProjectArchived(this.project, false).subscribe({
      next: (response:any) => {
        this.archiveProjectInProgress = false;
        if(response?.result === false || response?.data?.result === false) {
          return;
        }
        this.notifierService.notify("info", "Project '"+this.project.name+"' unarchived");
        this.projectService.fetchProjects(true).subscribe();
      },
      error: () => {
        this.archiveProjectInProgress = false;
      }
    });
  }

}
