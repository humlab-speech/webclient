import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';
import { nanoid } from 'nanoid'
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FileUploadService } from "../../../services/file-upload.service";
import { CreateProjectDialogComponent } from '../../project-manager/create-project-dialog/create-project-dialog.component';

@Component({
  selector: 'app-create-emudb-form',
  templateUrl: './create-emudb-form.component.html',
  styleUrls: ['./create-emudb-form.component.scss']
})
export class CreateEmudbFormComponent implements OnInit {

  @Input() context:any;
  status:string = "";
  sessions:FormArray;
  annotLevels:FormArray;
  annotLevelLinks:FormArray;
  parentFormComponent;
  parentForm:FormGroup;
  
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

  //createProjectForm:FormGroup;

  constructor(private fb:FormBuilder, private http:HttpClient, private fileUploadService:FileUploadService) {}

  ngOnInit(): void {
    this.parentFormComponent = this.context;
    this.parentForm = this.parentFormComponent.form;
    //this.createProjectForm = this.parentFormComponent.createProjectForm;

    this.sessions = this.fb.array([]);
    this.annotLevels = this.fb.array([]);
    this.annotLevelLinks = this.fb.array([]);

    this.parentForm.addControl("sessions", this.sessions);
    this.parentForm.addControl("annotLevels", this.annotLevels);
    this.parentForm.addControl("annotLevelLinks", this.annotLevelLinks);

    if(this.sessionForms.length == 0) {
      this.addSession();
    }
    if(this.annotLevelForms.length == 0) {
      this.addAnnotLevel("Word", "ITEM");
      this.addAnnotLevel("Phonetic", "SEGMENT");
    }
    
  }

  onUpload(event) {
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
      files: this.fb.array([])
    });
    this.sessionForms.push(session);
  }

  deleteSession(index) {
    this.sessionForms.removeAt(index);
  }

  onAudioUpload(event, session) {
    session.value.files.push(...event.addedFiles);
    console.log(session);

    //session.value.files.push(...event.addedFiles);

    //TODO: Disable submitting form here? - until upload is done

    let uploads:Promise<any>[] = [];

    for(let key in event.addedFiles) {
      let file:File = event.addedFiles[key];
      uploads.push(this.uploadFile(file, session));
    }

    Promise.all(uploads).then((result) => {
      //upload is done
    });

  }

  uploadFile(file:File, session) {
    return new Promise((resolve, reject) => {

      //this.fileUploadService.upload(file);

      this.fileUploadService.readFile(file).then(fileContents => {
        let headers = {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        let body = {
          filename: file.name,
          file: fileContents,
          context: this.parentFormComponent.formContextId,
          group: "emudb-sessions/"+session.controls.name.value
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

  get annotLevelsForm() {
    return this.annotLevels.value as FormArray;
  }

  get sessionForms() {
    return this.parentForm.get('sessions') as FormArray;
  }

  get annotLevelForms() {
    return this.parentForm.get('annotLevels') as FormArray;
  }

  get annotLevelLinkForms() {
    return this.parentForm.get('annotLevelLinks') as FormArray;
  }

}