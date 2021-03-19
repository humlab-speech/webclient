import { Component, OnInit, Input } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Project } from '../../models/Project';
import { ProjectService } from '../../services/project.service';
import { HsApp } from "../../models/HsApp";

@Component({
  selector: 'app-project-item',
  templateUrl: './project-item.component.html',
  styleUrls: ['./project-item.component.scss']
})
export class ProjectItemComponent implements OnInit {
  
  @Input() project: Project;

  statusMsg:string = "";
  domain:string = window.location.hostname;
  rstudioSaveInProgress:boolean = false;
  rstudioDeleteInProgress:boolean = false;
  projectMenuVisible:boolean = false;
  deleteProjectInProgress:boolean = false;
  menuTimeout:any;
  members:[];
  
  hsApplications:HsApp[];

  constructor(private http:HttpClient, private projectService:ProjectService) { }

  ngOnInit(): void {
    let rstudioApp = new HsApp();
    rstudioApp.name = "rstudio"; //This name needs to be the same as the (sub)-domain-name!
    rstudioApp.title = "RStudio";
    rstudioApp.icon = "app-icons/88x88-color/rstudio-icon.png";

    let emuWebApp = new HsApp();
    emuWebApp.name = "emuwebapp";
    emuWebApp.title = "EmuWebApp";
    emuWebApp.icon = "app-icons/88x88-color/emuwebapp-icon.png";

    let octraApp = new HsApp();
    octraApp.name = "octra";
    octraApp.title = "Octra";

    let jupyterApp = new HsApp();
    jupyterApp.name = "jupyter";
    jupyterApp.title = "Jupyter";
    jupyterApp.icon = "app-icons/88x88-color/jupyter-icon.png";
    
    let scriptApp = new HsApp();
    scriptApp.name = "script";
    scriptApp.title = "Scripts";
    scriptApp.icon = "app-icons/88x88-bw/script-icon.png";

    this.hsApplications = [rstudioApp, emuWebApp, jupyterApp, scriptApp];
    
    /*
    this.projectService.fetchProjectMembers(this.project.id).subscribe((response:any) => {
      this.members = response;
    });
    */
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
  

  deleteProject() {
    if(window.confirm('Are sure you want to delete this project? All data associated with this project will be lost.')){
      this.deleteProjectInProgress = true;
      this.projectService.deleteProject(this.project).subscribe(() => {
        this.projectService.updateProjects();
      });
    }
  }

}
