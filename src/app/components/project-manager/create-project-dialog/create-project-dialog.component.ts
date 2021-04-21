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

}
