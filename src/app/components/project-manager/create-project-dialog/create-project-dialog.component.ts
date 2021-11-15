import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray, AbstractControl } from '@angular/forms';
import { nanoid } from 'nanoid';
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';
import { Observable, of } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';
import { UserService } from 'src/app/services/user.service';
import { EmudbFormComponent } from '../../forms/emudb-form/emudb-form.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit {
  @ViewChild(EmudbFormComponent, { static: true }) public emudbFormComponent: EmudbFormComponent;

  EMUDB_INTEGRATION = environment.EMUDB_INTEGRATION;

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Create project";
  submitBtnEnabled:boolean = false;
  pendingUpload:boolean = false;
  showLoadingIndicator:boolean = false;
  submitBtnEnabledLockout:boolean = false;
  formValidationInterval:any;
  fileUploadsComlete:boolean = true;
  validateWaitInterval:any = null;
  setupEmuDbFormChangeListener:any = null;
  emuDbIntegrationEnabled:boolean = true;

  form:FormGroup;

  formContextId:string = nanoid();

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService, private userService:UserService, private fileUploadService:FileUploadService, private notifierService: NotifierService) {
    this.emuDbIntegrationEnabled = environment.EMUDB_INTEGRATION;
  }

  ngOnInit(): void {
    this.setLoadingStatus(false);

    this.form = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      standardDirectoryStructure: new FormControl(true),
      createEmuDb: new FormControl(environment.EMUDB_INTEGRATION),
      //emuDb: this.emudbFormComponent.getFormGroup()
    });

    if(this.emuDbIntegrationEnabled) {
      //This is stupid, but we need to wait for the emuDb-form-module to initialize
      this.setupEmuDbFormChangeListener = setInterval(() => {
        if(typeof this.emudbFormComponent.getFormGroup() != "undefined") {
          console.log("emudbFormComponent init");
          this.form.addControl("emuDb", this.emudbFormComponent.getFormGroup());
          clearInterval(this.setupEmuDbFormChangeListener);
          this.emudbFormComponent.getFormGroup().valueChanges.subscribe(() => {
            this.validateForm();
          });
          this.validateForm();
        }
      }, 100);
    }
    

    this.form.controls['projectName'].setAsyncValidators([this.validateProjectName(this.http, this.userService)]);
    this.form.controls['projectName'].statusChanges.subscribe(() => {
      this.validateForm();
    })


    

    this.fileUploadService.statusStream.subscribe((status) => {
      if(status == "uploads-in-progress") {
        this.fileUploadsComlete = false;
        this.validateForm();
      }
      if(status == "all-uploads-complete") {
        this.fileUploadsComlete = true;
        this.validateForm();
      }
    });

    document.getElementById("projectName").focus();
  }

  setLoadingStatus(isLoading = true) {
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = "Creating project";
      this.submitBtnEnabledLockout = true;
    }
    else {
      this.submitBtnEnabled = true;
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Create project";
      this.submitBtnEnabledLockout = false;
    }
  }
  
  validateForm() {
    if(this.form.valid && this.fileUploadsComlete) {
      if(this.emuDbIntegrationEnabled) {
        if(this.emudbFormComponent.getFormGroup().status == "VALID") {
          this.submitBtnEnabled = true;
        }
        else {
          this.submitBtnEnabled = false;
        }
      }
      else {
        this.submitBtnEnabled = true;
      }
    }
    else {
      this.submitBtnEnabled = false;
    }
    
    //Need to be patient with async validators
    if(this.form.status == "PENDING" && this.validateWaitInterval == null) {
      this.validateWaitInterval = setInterval(() => {
        this.validateForm();
      }, 500)
    }
    if(this.form.status != "PENDING") {
      clearInterval(this.validateWaitInterval);
      this.validateWaitInterval = null;
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

  async createProject(form) {
    this.setLoadingStatus(true);

    if(!this.validateForm()) {
      this.notifierService.notify('warning', "This form is not ready to be submitted yet.");
      this.setLoadingStatus(false);
      return false;
    }

    this.submitBtnEnabled = false;

    let formData = form.value;
    if(this.emuDbIntegrationEnabled) {
      formData.sessions = this.emudbFormComponent.sessions.value;
      formData.annotLevels = this.emudbFormComponent.annotLevels.value;
      formData.annotLevelLinks = this.emudbFormComponent.annotLevelLinks.value;
    }
   
    this.projectManager.projectsLoaded = false;
    
    this.projectService.createProject(form.value, this.formContextId).subscribe(msg => {
      let msgData = JSON.parse(msg.data);
      if(msgData.type == "cmd-result" && msgData.cmd == "createProject") {
        if(msgData.progress == "end") {
          this.projectService.fetchProjects(true).subscribe(msg => {
            console.log(msg);
          });
          this.form.reset();
          this.closeCreateProjectDialog();
        }
        else {
          let progressPercent = Math.ceil((msgData.progress / 16) * 100);
          let button = document.getElementById("submitBtn");
          button.style.background = 'linear-gradient(90deg, #73A790 '+progressPercent+'%, #654c4f '+progressPercent+'%)';
          button.style.color = "#fff";
          this.submitBtnLabel = msgData.result;
        }
      }
    });
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

      return http.get('https://gitlab.' + environment.BASE_DOMAIN + '/api/v4/projects?search=' + value, { headers })
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

}
