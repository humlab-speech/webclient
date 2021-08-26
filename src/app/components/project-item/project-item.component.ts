import { Component, OnInit, Input, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Project } from '../../models/Project';
import { ProjectService } from '../../services/project.service';
import { HsApp } from "../../models/HsApp";
import { Config } from "../../config";
import { ProjectManagerComponent } from '../project-manager/project-manager.component';

@Component({
  selector: 'app-project-item',
  templateUrl: './project-item.component.html',
  styleUrls: ['./project-item.component.scss']
})
export class ProjectItemComponent implements OnInit {
  
  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();

  @Input() project: Project;
  @Input() projectManager: ProjectManagerComponent;

  enabledApps = Config.ENABLED_APPLICATIONS;

  statusMsg:string = "";
  domain:string = window.location.hostname;
  rstudioSaveInProgress:boolean = false;
  rstudioDeleteInProgress:boolean = false;
  projectMenuVisible:boolean = false;
  deleteProjectInProgress:boolean = false;
  menuTimeout:any;
  members:[];
  
  hsApplications:HsApp[] = [];
  projectOperations:object[] = [];

  constructor(private http:HttpClient, private projectService:ProjectService) {
    
  }

  ngOnInit(): void {

    this.projectOperations.push({
      title: "Edit emuDB",
      callback: this.showImportAudioDialog
    });

    Config.ENABLED_APPLICATIONS.forEach((hsAppName) => {
      if(hsAppName == "rstudio") {
        let rstudioApp = new HsApp();
        rstudioApp.name = "rstudio"; //This name needs to be the same as the (sub)-domain-name!
        rstudioApp.title = "RStudio";
        rstudioApp.icon = "app-icons/88x88-color/rstudio-icon.png";
        this.hsApplications.push(rstudioApp);
      }
      if(hsAppName == "emu-webapp") {
        let emuWebApp = new HsApp();
        emuWebApp.name = "emu-webapp";
        emuWebApp.title = "Emu-WebApp";
        emuWebApp.icon = "app-icons/88x88-color/emuwebapp-icon.png";
        this.hsApplications.push(emuWebApp);
      }
      if(hsAppName == "jupyter") {
        let jupyterApp = new HsApp();
        jupyterApp.name = "jupyter";
        jupyterApp.title = "Jupyter";
        jupyterApp.icon = "app-icons/88x88-color/jupyter-icon.png";
        this.hsApplications.push(jupyterApp);
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

    });

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
    this.projectManager.projectInEdit = project;
    this.projectManager.showEditEmuDbDialog();
  }

  deleteProject() {
    if(window.confirm('Are sure you want to delete this project? All data associated with this project will be lost.')){
      this.deleteProjectInProgress = true;
      this.projectService.deleteProject(this.project).subscribe(() => {
        this.projectService.fetchProjects(true).subscribe();
      });
    }
    
  }

}
