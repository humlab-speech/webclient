import { Component, Input, OnInit } from '@angular/core';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { Project } from "../../models/Project";
import { ProjectService } from '../../services/project.service';
import { SystemService } from 'src/app/services/system.service';
import {
  Validators,
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import { HttpHeaders } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { nanoid } from "nanoid";

@Component({
  selector: 'app-manage-sessions-dialog',
  templateUrl: './manage-sessions-dialog.component.html',
  styleUrls: ['./manage-sessions-dialog.component.scss']
})
export class ManageSessionsDialogComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  form:FormGroup;
  sessions:any = [];

  constructor(private fb:FormBuilder, private projectService:ProjectService, private systemService:SystemService, private http:HttpClient) { }

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;

    //Load sessions in this project
    this.projectService.fetchProjectSessions(this.project.id).subscribe((sessions) => {
      this.sessions = sessions;
    });

    this.form = this.fb.group({
      projectMembers: this.fb.array([])
    });

    this.form.addControl("sessionName", new FormControl(nanoid(), [
      Validators.required,
      Validators.minLength(3),
      Validators.pattern("[a-zA-Z0-9 \\\-_]*")
    ]));
    this.form.addControl("sessionScript", new FormControl(1245));
  }

  startRecordingSession(project) {
    console.log(this.form.value)

    
    //1. Set a cookie designating which project this new session will belong to
    document.cookie = 'currentProject='+project.id;
    //2. Create the spr-metadata (json) for the new session and write this to file
    
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/json',
      })
    };

    let payload = {
      project: project.id,
      sessionId: this.form.value.sessionName,
      script: this.form.value.sessionScript
    }
    
    this.http.post<any>("/spr/api/v1/session/new", payload, httpOptions).subscribe((response) => {
      window.location.href = "/spr/session/"+payload.sessionId;
    }, error => {
      console.error(error);
    })
      
    //3. Redirect browser to the spr with the new session metadata as the target 
    //window.location.href = 'https://'+window.location.hostname+'/spr/session/2';
  }

  closeDialog() {
    /*
    if(this.manageProjectMembersFormComponent.sessionAccessCode != null) {
      this.manageProjectMembersFormComponent.shutdownSession();
    }
    */
    this.projectManager.dashboard.modalActive = false;
  }
}
