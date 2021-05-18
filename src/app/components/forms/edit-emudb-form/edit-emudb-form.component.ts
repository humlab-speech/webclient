import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray, AbstractControl } from '@angular/forms';
import { NotifierService } from 'angular-notifier';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from '../../../models/Project';
import { ProjectManagerComponent } from '../../project-manager/project-manager.component';

@Component({
  selector: 'app-edit-emudb-form',
  templateUrl: './edit-emudb-form.component.html',
  styleUrls: ['./edit-emudb-form.component.scss']
})
export class EditEmudbFormComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;

  form:FormGroup;
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

  project:Project|null = null;

  constructor(private fb:FormBuilder, private notifierService: NotifierService, private projectService: ProjectService) { }

  ngOnInit(): void {
    this.form = this.fb.group({

    });

    this.sessions = this.fb.array([]);
    this.annotLevels = this.fb.array([]);
    this.annotLevelLinks = this.fb.array([]);

    this.form.addControl("sessions", this.sessions);
    this.form.addControl("annotLevels", this.annotLevels);
    this.form.addControl("annotLevelLinks", this.annotLevelLinks);

    this.project = this.projectManager.projectInEdit;

    console.log(this.project);

    this.loadEmuDb();
  }

  loadEmuDb() {
    //Spin up an operations container
    this.projectService.getSession(this.project.id);
    //clone out the project
    //scan the emudb and fetch all the sessions & bundles & annotation levels & links
  }

  addSession() {

  }

  addAnnotLevel() {

  }

  addAnnotLevelLink() {

  }

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
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

}
