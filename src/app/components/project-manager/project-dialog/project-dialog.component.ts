import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray, AbstractControl, FormControlName } from '@angular/forms';
import { nanoid } from 'nanoid';
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';
import { Observable, of, Subject } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';
import { UserService } from 'src/app/services/user.service';
import { SessionsFormComponent as SessionsFormComponent } from '../../forms/sessions-form/sessions-form.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-project-dialog',
  templateUrl: './project-dialog.component.html',
  styleUrls: ['./project-dialog.component.scss']
})
export class ProjectDialogComponent implements OnInit {
  @ViewChild(SessionsFormComponent, { static: true }) public emudbFormComponent: SessionsFormComponent;

  EMUDB_INTEGRATION = environment.EMUDB_INTEGRATION;

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Create project";
  isLoading:boolean = false;
  submitBtnEnabled:boolean = false;
  pendingUpload:boolean = false;
  showLoadingIndicator:boolean = false;
  submitBtnEnabledLockout:boolean = false;
  formValidationInterval:any;
  fileUploadsComlete:boolean = true;
  validateWaitInterval:any = null;
  setupEmuDbFormChangeListener:any = null;
  emuDbIntegrationEnabled:boolean = true;
  docFiles:FormArray;
  project:any = null;
  emuDb:any = null;
  dialogTitle:string = "Create new project";
  emuDbLoadedSubject:Subject<boolean> = new Subject<boolean>();
  emuDbLoaded$:Observable<boolean> = this.emuDbLoadedSubject.asObservable();

  form:FormGroup;

  formContextId:string = nanoid();

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService, private userService:UserService, private fileUploadService:FileUploadService, private notifierService: NotifierService) {
    this.emuDbIntegrationEnabled = environment.EMUDB_INTEGRATION;
  }

  ngOnInit(): void {
    this.setLoadingStatus(false);

    this.docFiles = this.fb.array([]);

    this.form = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      docFiles: this.docFiles,
      standardDirectoryStructure: new FormControl(true),
      createEmuDb: new FormControl(environment.EMUDB_INTEGRATION),
    });

    this.form.statusChanges.subscribe((status) => {
      this.validateForm();
    });

    if(this.emuDbIntegrationEnabled) {
      //This is stupid, but we need to wait for the sessions-form-module to initialize
      this.setupEmuDbFormChangeListener = setInterval(() => {
        if(typeof this.emudbFormComponent.getFormGroup() != "undefined") {
          this.form.addControl("emuDb", this.emudbFormComponent.getFormGroup());
          clearInterval(this.setupEmuDbFormChangeListener);
        }
      }, 100);
    }
    

    this.form.controls['projectName'].setAsyncValidators([this.validateProjectName(this.http, this.userService)]);

    this.fileUploadService.statusStream.subscribe((status) => {
      if(status == "uploads-in-progress") {
        this.fileUploadsComlete = false;
      }
      if(status == "all-uploads-complete") {
        this.fileUploadsComlete = true;
      }
    });

    document.getElementById("projectName").focus();
    

    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null

    //If there's a project associated with this dialog, load it in a container so we have access to it
    if(this.project != null) {
      this.dialogTitle = "Edit project "+this.project.name;
      this.form.addControl("project", new FormControl(this.project));
      this.form.controls.projectName.setValue(this.project.name);
      this.form.controls.projectName.disable();

      this.setLoadingStatus(true);
      console.log("Going into edit mode");
      
      this.projectService.fetchEmuDbInProject(this.project.id).subscribe(emuDb => {
        this.emuDb = emuDb;
        this.emuDbLoadedSubject.next(true);
        this.setLoadingStatus(false);
      });
    }
    else {
      this.setLoadingStatus(false);
    }

  }

  setLoadingStatus(isLoading = true, label = "Loading") {
    this.isLoading = isLoading;
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = label;
      this.submitBtnEnabledLockout = true;
    }
    else {
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Save";
      this.submitBtnEnabledLockout = false;
    }
  }
  
  validateForm() {
    if(this.fileUploadsComlete && this.form.status == "VALID") {
      this.submitBtnEnabled = true;
    }
    else {
      this.submitBtnEnabled = false;
    }

    return this.submitBtnEnabled;
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

  async saveProject(form) {
    this.setLoadingStatus(true);

    if(!this.validateForm()) {
      this.notifierService.notify('warning', "This form is not ready to be submitted yet.");
      this.setLoadingStatus(false);
      return false;
    }

    this.projectService.loadingStatus$.subscribe(status => {
      this.submitBtnLabel = status;
    });

    this.projectService.saveProject(form.form).then(result => {
      this.projectService.fetchProjects(true).subscribe(msg => {
        this.setLoadingStatus(false);
        this.closeCreateProjectDialog();
      });
    });
  }

  setTaskProgress(progressStep, totalNumSteps, targetElementId = null, msg = null) {
    let progressPercent = Math.ceil((progressStep / totalNumSteps) * 100);
    if(targetElementId != null) {
      let targetEl = document.getElementById(targetElementId);
      targetEl.style.background = 'linear-gradient(90deg, #73A790 '+progressPercent+'%, #654c4f '+progressPercent+'%)';
      targetEl.style.color = "#fff";
    }
    if(msg != null) {
      this.submitBtnLabel = msg;
    }
  }

  closeCreateProjectDialog() {
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }

  onAudioUpload(event, session) {
    let allowedFilesTypes = ['audio/wav', 'audio/x-wav'];

    for(let key in event.addedFiles) {
      if(allowedFilesTypes.includes(event.addedFiles[key].type) == false) {
        this.notifierService.notify('warning', 'There file ' + event.addedFiles[key].name + ' is of an invalid type ' + event.addedFiles[key].type + '. Please only upload WAV files here.');
        event.addedFiles.splice(key, 1);
      }
    }

    if(event.addedFiles.length == 0) {
      return;
    }

    session.value.files.push(...event.addedFiles);

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file, session).then(() => {
      })
    }
  }

  async uploadFile(file:File, session) {
    return await this.fileUploadService.upload(file, this.formContextId, "emudb-sessions/"+session.controls.id.value);
  }
  
  onRemove(event, session) {
    session.value.files.splice(session.value.files.indexOf(event), 1);
    //TODO: Remove the uploaded file from the server?
  }

  validateProjectName(http:HttpClient, userService:UserService) {
    return function(control:AbstractControl):Observable<ValidationErrors> | null {
      const value: string = control.value;

      let session = userService.getSession();
      let headers = {
        "PRIVATE-TOKEN": session.personalAccessToken
      };

      return http.get(window.location.protocol+'//gitlab.' + environment.BASE_DOMAIN + '/api/v4/projects?search=' + value, { headers })
      .pipe(
        debounceTime(500),
        map( (projects:any) => {
          let isFormNameTaken = false;
          for(let key in projects) {
            if(projects[key].name == value) {
              isFormNameTaken = true;
            }
          }
          return isFormNameTaken ? { 'isFormNameTaken': isFormNameTaken } : null;
        })
      );
    }
  }

  onDocDrop(event) { //this is from the docs form
    this.docFiles.value.push(...event.addedFiles);
  }

}
