import { Component, OnInit, Input } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { nanoid } from 'nanoid'
import { EmuSession } from "../../../models/EmuSession";
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Save project";
  submitBtnEnabled:boolean = true;
  files: File[] = [];
  sessions:EmuSession[] = [];
  createProjectContextId:string = nanoid();
  createProjectForm = new FormGroup({
    projectName: new FormControl(''),
    genEmuDb: new FormControl(true)
  });

  constructor(private http:HttpClient, private projectService:ProjectService) { }

  ngOnInit(): void {
    this.addSession();
  }

  addSession() {
    let session:EmuSession = {
      name: "Session "+(this.sessions.length+1),
      files: []
    }
    this.sessions.push(session);
  }

  deleteSession(session) {
    let index = this.sessions.indexOf(session);
    this.sessions.splice(index, 1);
  }

  getSession(session) {
    return this.sessions[this.sessions.indexOf(session)];
  }

  onSelect(event, session) {
    session.files.push(...event.addedFiles);
    console.log(session);

    this.submitBtnEnabled = false;
    this.submitBtnLabel = "Uploading...";

    let uploads:Promise<any>[] = [];

    for(let key in event.addedFiles) {
      let file:File = event.addedFiles[key];
      uploads.push(this.uploadFile(file, session));
    }

    Promise.all(uploads).then((result) => {
      this.submitBtnEnabled = true;
      this.submitBtnLabel = "Save project";
    });

  }

  uploadFile(file:File, session) {
    return new Promise((resolve, reject) => {
      this.readFile(file).then(fileContents => {
        let headers = {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        let body = {
          filename: file.name,
          file: fileContents,
          context: this.createProjectContextId,
          session: session.name
        };
        this.http.post<any>("/api/v1/upload", "data="+JSON.stringify(body), { headers }).subscribe(data => {
          console.log("Uploaded "+file.name);
          console.log(data);
          resolve(data);
        });
      });
    });
  }
  
  onRemove(event, session) {
    session.files.splice(session.files.indexOf(event), 1);
  }


  private async readFile(file: File): Promise<string | ArrayBuffer> {
    return new Promise<string | ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        return resolve((e.target as FileReader).result);
      };

      reader.onerror = e => {
        console.error(`FileReader failed on file ${file.name}.`);
        return reject(null);
      };

      if (!file) {
        console.error('No file to read.');
        return reject(null);
      }

      reader.readAsDataURL(file);
    });
  }



  dumpSession() {
    console.log("Dump Session");
    let obs = this.http.get("/api/v1/magick", {
      responseType: "text"
    });
    obs.subscribe((data) => {
      console.log(data);
    });
  }

  createProject() {
    if(!this.submitBtnEnabled) {
      console.log("Can't submit project - not ready yet");
      return false;
    }

    console.log("Submitting project");

    this.projectManager.projectsLoaded = false;
    let projectCreate$ = this.projectService.createProject(
      this.createProjectForm.controls.projectName.value,
      this.createProjectForm.controls.genEmuDb.value,
      this.createProjectContextId
      );
    projectCreate$.subscribe((data) => {
      console.log(data);
      //this.projectsLoaded = true;
      this.createProjectForm.reset();
    });

    this.closeCreateProjectDialog();
  }

  closeCreateProjectDialog() {
    this.projectManager.showCreateProjectDialog = false;
  }

}
