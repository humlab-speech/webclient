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
      if(vispAppName == "rstudio") {
        let rstudioApp = new VispApp();
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
          this.vispApplications.push(rstudioApp);
        }
      }
      if(vispAppName == "emu-webapp") {
        let emuWebApp = new VispApp();
        emuWebApp.name = "emu-webapp";
        emuWebApp.title = "Transcription tool";
        emuWebApp.icon = "app-icons/88x88-color/emuwebapp-icon.png";
        emuWebApp.disabled = this.shouldAppBeDisabled(emuWebApp.name);
        this.vispApplications.push(emuWebApp);
      }
      if(vispAppName == "jupyter") {
        let jupyterApp = new VispApp();
        jupyterApp.name = "jupyter";
        jupyterApp.title = "Notebook tool";
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

  transcribeDialog(project) {
    this.projectManager.projectInEdit = this.project;
    this.projectManager.showTranscribeDialog(project);
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

  /**
   * Classify health issues into fixable (by cleanupOrphanedSessions) vs informational.
   * Fixable: orphaned session dirs on disk, ghost sessions in MongoDB.
   * Informational: file count mismatch, orphaned bundles, missing config.
   */
  private classifyIssues(issues: string[]): { fixable: string[]; informational: string[] } {
    const fixable: string[] = [];
    const informational: string[] = [];
    for (const issue of issues) {
      if (issue.includes('orphaned EmuDB session') || issue.includes('missing from disk')) {
        fixable.push(issue);
      } else {
        informational.push(issue);
      }
    }
    return { fixable, informational };
  }

  showCleanupConfirmation() {
    const issues = this.project.healthStatus.issues;
    const { fixable, informational } = this.classifyIssues(issues);

    let message = `Project "${this.project.name}" has consistency issues:\n\n`;

    if (fixable.length > 0) {
      message += `Fixable by cleanup:\n${fixable.map(i => '  • ' + i).join('\n')}\n\n`;
      message += 'Cleanup will:\n'
        + '  • Delete orphaned directories on disk\n'
        + '  • Mark ghost sessions in the database as deleted\n\n'
        + 'This cannot be undone.\n';
    }

    if (informational.length > 0) {
      message += `\nNot fixable from the browser:\n${informational.map(i => '  • ' + i).join('\n')}\n\n`;
      message += 'These issues require server-side repair. Contact an administrator.\n';
    }

    if (fixable.length > 0) {
      message += '\nProceed with cleanup?';
      if (window.confirm(message)) {
        console.log(`[VISP] Starting cleanup for project '${this.project.name}'`);
        console.log(`[VISP] Fixable issues:`, fixable);
        if (informational.length > 0) {
          console.log(`[VISP] Informational (not fixable by cleanup):`, informational);
        }
        this.cleanupOrphanedSessions();
      }
    } else {
      // No fixable issues — show info-only dialog
      message += '\nNo issues can be fixed from the browser.';
      window.alert(message);
      console.log(`[VISP] Health issues for '${this.project.name}' (all informational):`, informational);
    }
  }

  cleanupOrphanedSessions() {
    const projectId: string = String(this.project.id);
    const projectName: string = this.project.name;
    console.log(`[VISP] Sending cleanup command for project '${projectName}'...`);

    this.projectService.cleanupOrphanedSessions(projectId).subscribe(
      (msg: any) => {
        console.log(`[VISP] Cleanup response for '${projectName}':`, msg);
        const result = msg.data || msg;

        if (result.success) {
          const actions = [];
          if (result.removed && result.removed.length > 0) {
            actions.push(`Removed ${result.removed.length} orphaned dir(s): ${result.removed.join(', ')}`);
          }
          if (result.purged && result.purged.length > 0) {
            actions.push(`Marked ${result.purged.length} ghost session(s) as deleted: ${result.purged.join(', ')}`);
          }
          if (actions.length > 0) {
            console.log(`[VISP] Cleanup succeeded for '${projectName}':`, actions);
            this.notifierService.notify("success", actions.join('. '));
          } else {
            console.warn(`[VISP] Cleanup for '${projectName}' completed but no changes were made.`);
            this.notifierService.notify("info",
              "No session-level issues to fix. Remaining issues may require server-side repair.");
          }
          // Refresh project list to update health status
          this.projectService.fetchProjects(true).subscribe();
        } else {
          const errorMsg = (result.errors && result.errors.length > 0) ? result.errors.join('; ') : 'Unknown error';
          console.error(`[VISP] Cleanup failed for '${projectName}':`, result.errors);
          this.notifierService.notify("error", `Cleanup failed: ${errorMsg}`);
        }
      },
      (error) => {
        console.error(`[VISP] Cleanup error for '${projectName}':`, error);
        console.error(`[VISP] Hint: The cleanup command may not be supported by this version. ` +
          `Try rebuilding session-manager.`);
        this.notifierService.notify("error",
          "Cleanup failed — check browser console for details");
      }
    );
  }

}
