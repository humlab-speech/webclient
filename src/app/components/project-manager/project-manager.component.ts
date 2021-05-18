import { Component, Input, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { ProjectService } from "../../services/project.service";
import { Project } from "../../models/Project";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FormControl, FormGroup } from '@angular/forms';
import { CreateProjectDialogComponent } from './create-project-dialog/create-project-dialog.component';

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

  constructor(private userService:UserService, private projectService:ProjectService, private http:HttpClient) { }

  ngOnInit():void {

    console.log(this.dashboard);

    window.addEventListener('project-create-in-progress', () => {
      this.projectCreateInProgress = true;
    });

    window.addEventListener('project-create-done', () => {
      this.projectCreateInProgress = false;
    });

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

    this.projectService.projects$.subscribe((projects) => {
      this.projects = projects;
      this.projectsLoaded = true;
    });
  }

  showEditEmuDbDialog() {
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'edit-emudb-dialog';
  }

  showCreateProjectDialog() {
    this.dashboard.modalActive = true;
    this.dashboard.modalName = 'create-project-dialog';
  }
}
