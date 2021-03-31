import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';
import { nanoid } from 'nanoid'
import { EmuSession } from "../../../models/EmuSession";
import { AnnotLevel } from "../../../models/AnnotLevel";
import { AnnotLevelLink } from "../../../models/AnnotLevelLink";
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
  submitBtnEnabled:boolean = false;
  files: File[] = [];
  sessions:FormArray;
  annotLevels:FormArray;
  annotLevelLinks:FormArray;
  
  annotLevelTypes = [
    'ITEM',
    'SEGMENT',
    'EVENT'
  ];
  
  annotLevelLinkTypes = [
    'ONE_TO_MANY',
    'ONE_TO_ONE',
    'MANY_TO_MANY'
  ];
  
  createProjectContextId:string = nanoid();

  createProjectForm:FormGroup;

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService) { }

  ngOnInit(): void {

    this.sessions = this.fb.array([]);
    this.annotLevels = this.fb.array([]);
    this.annotLevelLinks = this.fb.array([]);

    this.createProjectForm = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      genEmuDb: new FormControl(true),
      sessions: this.sessions,
      annotLevels: this.annotLevels,
      annotLevelLinks: this.annotLevelLinks
    });

    this.createProjectForm.valueChanges.subscribe((values) => {
      if(this.createProjectForm.status != "INVALID") {
        this.submitBtnEnabled = true;
      }
      else {
        this.submitBtnEnabled = false;
      }
    });

    this.addSession();
    this.addAnnotLevel("Word", "ITEM");
    this.addAnnotLevel("Phonetic", "SEGMENT");

    document.getElementById("projectName").focus();
  }

  get annotLevelsForm() {
    return this.annotLevels.value as FormArray;
  }

  get projectName() {
    return this.createProjectForm.get('projectName');
  }

  get sessionForms() {
    return this.createProjectForm.get('sessions') as FormArray;
  }

  get annotLevelForms() {
    return this.createProjectForm.get('annotLevels') as FormArray;
  }

  get annotLevelLinkForms() {
    return this.createProjectForm.get('annotLevelLinks') as FormArray;
  }

  addAnnotLevel(name = "", type = "ITEM") {
    const annotLevel = this.fb.group({
      name: new FormControl(name, [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")]),
      type: new FormControl(type, Validators.required)
    });

    this.annotLevelForms.push(annotLevel);
  }

  deleteAnnotLevel(index) {
    this.annotLevelForms.removeAt(index);
  }

  addAnnotLevelLink(superLevel = null, subLevel = null, type = "ONE_TO_MANY") {
    const annotLevelLink = this.fb.group({
      superLevel: new FormControl(superLevel, Validators.required),
      subLevel: new FormControl(subLevel, Validators.required),
      type: new FormControl(type, Validators.required)
    });

    this.annotLevelLinkForms.push(annotLevelLink);
  }

  deleteAnnotLevelLink(index) {
    this.annotLevelLinkForms.removeAt(index);
  }

  addSession() {
    const session = this.fb.group({
      name: new FormControl('Session '+(this.sessionForms.length+1), {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      files: []
    });

    this.sessionForms.push(session);
  }

  deleteSession(index) {
    this.sessionForms.removeAt(index);
  }

  onDocUpload(event) {
    console.log(event);
  }

  onAudioUpload(event, session) {
    if(!session.value.files) {
      session.value.files = [];
    }

    session.value.files.push(...event.addedFiles);

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
          session: session.controls.name.value
        };
        this.http.post<any>("/api/v1/upload", "data="+JSON.stringify(body), { headers }).subscribe(data => {
          resolve(data);
        });
      });
    });
  }
  
  onRemove(event, session) {
    session.value.files.splice(session.value.files.indexOf(event), 1);
    //TODO: Remove the uploaded file from the server?
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

  createProject(form) {
    if(this.createProjectForm.status != "INVALID" && !this.submitBtnEnabled) {
      console.log("Can't submit project - not ready yet");
      return false;
    }

    this.projectManager.projectsLoaded = false;
    this.projectService.createProject(form.value, this.createProjectContextId);
    this.createProjectForm.reset();
    this.closeCreateProjectDialog();
  }

  closeCreateProjectDialog() {
    this.projectManager.showCreateProjectDialog = false;
  }

}
