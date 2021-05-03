import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';
import { nanoid } from 'nanoid';
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';
import { Config } from '../../../config';


@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit {

  EMUDB_INTEGRATION = Config.EMUDB_INTEGRATION;

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Save project";
  submitBtnEnabled:boolean = false;
  pendingUpload:boolean = false;

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


  form:FormGroup;

  formContextId:string = nanoid();

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService, private fileUploadService:FileUploadService, private notifierService: NotifierService) { }

  ngOnInit(): void {

    this.form = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      standardDirectoryStructure: new FormControl(true),
      createEmuDb: new FormControl(Config.EMUDB_INTEGRATION)
    });

    this.form.valueChanges.subscribe((values) => {
      console.log("valuechange");
      if(this.form.status != "INVALID" && this.fileUploadService.hasPendingUploads == false) {
        this.submitBtnEnabled = true;
      }
      else {
        this.submitBtnEnabled = false;
      }
    });


    this.sessions = this.fb.array([]);
    this.annotLevels = this.fb.array([]);
    this.annotLevelLinks = this.fb.array([]);

    this.form.addControl("sessions", this.sessions);
    this.form.addControl("annotLevels", this.annotLevels);
    this.form.addControl("annotLevelLinks", this.annotLevelLinks);

    if(this.sessionForms.length == 0) {
      this.addSession();
    }
    if(this.annotLevelForms.length == 0) {
      this.addAnnotLevel("Word", "ITEM");
      this.addAnnotLevel("Phonetic", "SEGMENT");
    }


    document.getElementById("projectName").focus();

    document.addEventListener("pendingFormUploads", () => {
      console.log("received: pendingFormUploads");
      this.submitBtnEnabled = false;
    });

    document.addEventListener("pendingFormUploadsComplete", () => {
      console.log("received: pendingFormUploadsComplete");
      if(this.form.status != "INVALID") {
        this.submitBtnEnabled = true;
      }
    });
  }
  

  get projectName() {
    return this.form.get('projectName');
  }

  get standardDirectoryStructure() {
    return this.form.get('standardDirectoryStructure');
  }

  get createEmuDb() {
    return this.form.get('createEmuDb');
  }

  get annotLevelsForm() {
    return this.annotLevels.value as FormArray;
  }

  get sessionForms() {
    return this.form.get('sessions') as FormArray;
  }

  get annotLevelForms() {
    return this.form.get('annotLevels') as FormArray;
  }

  get annotLevelLinkForms() {
    return this.form.get('annotLevelLinks') as FormArray;
  }

  createProject(form) {
    if(this.form.status != "INVALID" && !this.submitBtnEnabled) {
      console.log("Can't submit project - not ready yet");
      return false;
    }

    if(this.fileUploadService.hasPendingUploads == true) {
      this.notifierService.notify('info', 'There are file uploads in progress, please wait until they are complete.');
      return false;
    }

    this.projectManager.projectsLoaded = false;
    this.projectService.createProject(form.value, this.formContextId);
    this.form.reset();
    this.closeCreateProjectDialog();
  }

  closeCreateProjectDialog() {
    this.projectManager.dashboard.modalActive = false;
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

    for(let key in event.addedFiles) {
      if(event.addedFiles[key].type != "audio/wav") {
        this.notifierService.notify('warning', 'There file ' + event.addedFiles[key].name + ' is of an invalid type ' + event.addedFiles[key].type + '. Please only upload WAV files here.');
        event.addedFiles.splice(key, 1);
      }
      event.addedFiles[key].uploadComplete = false;
    }

    if(event.addedFiles.length == 0) {
      return;
    }

    session.value.files.push(...event.addedFiles);

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file, session).then(() => {
        this.notifierService.notify('info', 'Upload of ' + file.name + ' complete.');
        file.uploadComplete = true;
      })
    }
  }

  uploadFile(file:File, session) {
    return new Promise((resolve, reject) => {

      this.fileUploadService.readFile(file).then(fileContents => {
        let headers = {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        let body = {
          filename: file.name,
          file: fileContents,
          context: this.formContextId,
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

}
