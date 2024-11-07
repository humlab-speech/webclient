import { Component, OnInit, Input, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Project } from '../../models/Project';
import { ProjectService } from '../../services/project.service';
import { HsApp } from "../../models/HsApp";
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
  menuTimeout:any;
  members:[];
  projectMembersUrl:string = "";

  hsApplications:HsApp[] = [];
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

    environment.ENABLED_APPLICATIONS.forEach((hsAppName) => {
      if(hsAppName == "rstudio") {
        let rstudioApp = new HsApp();
        rstudioApp.name = "rstudio"; //This name needs to be the same as the (sub)-domain-name!
        rstudioApp.title = "RStudio";
        rstudioApp.icon = "app-icons/88x88-color/rstudio-icon.png";
        rstudioApp.disabled = this.shouldAppBeDisabled(rstudioApp.name);

        //If an jupyter container is running, disable launching rstudio to avoid git commit conflicts
        this.project.liveAppSessions.forEach(session => {
          if(session.type == "jupyter") {
            rstudioApp.disabled = true;
          }
        });
        if(projectMember.role == "admin" || projectMember.role == "analyzer") {
          this.hsApplications.push(rstudioApp);
        }
      }
      if(hsAppName == "emu-webapp") {
        let emuWebApp = new HsApp();
        emuWebApp.name = "emu-webapp";
        emuWebApp.title = "Transcription tool";
        emuWebApp.icon = "app-icons/88x88-color/emuwebapp-icon.png";
        emuWebApp.disabled = this.shouldAppBeDisabled(emuWebApp.name);
        this.hsApplications.push(emuWebApp);
      }
      if(hsAppName == "jupyter") {
        let jupyterApp = new HsApp();
        jupyterApp.name = "jupyter";
        jupyterApp.title = "Notebook tool";
        jupyterApp.icon = "app-icons/88x88-color/jupyter-icon.png";
        jupyterApp.disabled = this.shouldAppBeDisabled(jupyterApp.name);
        
        if(projectMember.role == "admin" || projectMember.role == "analyzer") {
          this.hsApplications.push(jupyterApp);
        }
      }
      if(hsAppName == "octra") {
        let octraApp = new HsApp();
        octraApp.name = "octra";
        octraApp.title = "Octra";
        //this.hsApplications.push(octraApp);
      }
      if(hsAppName == "script") {
        let scriptApp = new HsApp();
        scriptApp.name = "script";
        scriptApp.title = "Scripts";
        scriptApp.icon = "app-icons/88x88-bw/script-icon.png";
        //this.hsApplications.push(scriptApp);
      }
      if(hsAppName == "vscode") {
        let vscodeApp = new HsApp();
        vscodeApp.name = "vscode";
        vscodeApp.title = "VS Code";
        vscodeApp.icon = "app-icons/88x88-color/vscode-icon.png";
        vscodeApp.disabled = this.shouldAppBeDisabled(vscodeApp.name);

        this.hsApplications.push(vscodeApp);
      }

    });

    this.hsApplications.reverse();
  }

  sessionsDialog(project) {
    this.projectManager.projectInEdit = project; //not sure this is needed
    this.projectManager.showSessionsDialog();
  }

  manageMembers(project) {
    this.projectManager.projectInEdit = project;
    this.projectManager.showManageMembersDialog();
  }

  manageBundleLists(project) {
    this.projectManager.projectInEdit = project;
    this.projectManager.showManageBundleListsDialog();
  }

  shouldAppBeDisabled(appName) {
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
      this.hsApplications.forEach(hsApp => {
        if(hsApp.name != msg.app) {
          hsApp.disabled = true;
        }
      });
    }
    if(msg.type == "close") {
      this.hsApplications.forEach(hsApp => {
        hsApp.disabled = false;
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
    this.projectManager.showProjectDialog(project);
  }

  openSprScriptsDialog(project:Project) {
    this.projectManager.showSprScriptsDialog(project);
  }

  deleteProject() {
    if(window.confirm('Are sure you want to delete this project? All data associated with this project will be lost.')){
      this.deleteProjectInProgress = true;
      this.projectService.deleteProject(this.project).subscribe(() => {
        this.notifierService.notify("info", "Project '"+this.project.name+"' deleted");
        this.projectService.fetchProjects(true).subscribe();
      });
    }
  }

}
