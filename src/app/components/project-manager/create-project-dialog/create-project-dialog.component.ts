import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';
import { nanoid } from 'nanoid';
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';
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

  form:FormGroup;

  formContextId:string = nanoid();

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService) { }

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
      if(this.form.status != "INVALID") {
        this.submitBtnEnabled = true;
      }
      else {
        this.submitBtnEnabled = false;
      }
    });

    document.getElementById("projectName").focus();
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

    this.projectManager.projectsLoaded = false;
    this.projectService.createProject(form.value, this.formContextId);
    this.form.reset();
    this.closeCreateProjectDialog();
  }

  closeCreateProjectDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

}
