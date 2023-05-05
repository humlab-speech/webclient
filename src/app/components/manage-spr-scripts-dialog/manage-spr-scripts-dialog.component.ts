import { Component, Input, OnInit } from '@angular/core';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { Project } from "../../models/Project";
import { ProjectService } from '../../services/project.service';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';
import { NotifierService } from 'angular-notifier';
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
  selector: 'app-manage-spr-scripts-dialog',
  templateUrl: './manage-spr-scripts-dialog.component.html',
  styleUrls: ['./manage-spr-scripts-dialog.component.scss']
})
export class ManageSprScriptsDialogComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  submitBtnLabel:string = "Save";
  submitBtnEnabled:boolean = false;
  showLoadingIndicator:boolean = false;
  form:FormGroup;
  sessions:any = [];
  scripts:FormArray;

  constructor(private fb:FormBuilder, 
    private projectService:ProjectService, 
    private systemService:SystemService, 
    private http:HttpClient, 
    private notifierService: NotifierService,
    private userService:UserService
    ) { }

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;

    this.scripts = this.fb.array([]);
    this.form = this.fb.group({
      scripts: this.scripts
    });

    let user = this.userService.getSession();
    this.projectService.fetchSprScripts(user.id).subscribe((response:any) => {
      response.result.forEach((script) => {
        this.addScript(script);
      });

      this.form.valueChanges.subscribe((newValues) => {
        this.submitBtnEnabled = this.form.valid;
      });
    });

    //this.addScript();
  }

  canEditScript(script) {
    let user = this.userService.getSession();
    return user.id == script.ownerId;
  }

  addScript(script = null) {

    if(script != null && !this.canEditScript(script)) {
      //if this is not 'my' script, and just a shared script, don't add it
      return;
    }

    let newScript = script == null ? true : false;

    const scripts = this.form.get('scripts') as FormArray;
    let scriptFg = this.fb.group({
      scriptId: new FormControl(script != null ? script.scriptId : nanoid()),
      collapsed: new FormControl(!newScript),
      new: new FormControl(newScript),
      name: new FormControl({ value: script != null ? script.name : "", disabled: false }, [
        Validators.required,
        Validators.minLength(3),
        Validators.pattern("[a-zA-Z0-9 \\\-_]*")
      ]),
      sharing: new FormControl(script != null ? script.sharing : "none"),
      prompts: this.fb.array([])
    });

    if(newScript) {
      scripts.insert(0, scriptFg);
    }
    else {
      scripts.push(scriptFg);
    }
    
    
    //if this is a new script, add a prompt
    if(scriptFg.controls.new.value) {
      this.addPrompt(scriptFg);
    }

    //if this is an existing script, add the prompts
    if(script != null) {
      script.sections[0].groups[0].promptItems.forEach((prompt) => {
        this.addPrompt(scriptFg, prompt);
      });
    }

  }

  addPrompt(script:FormGroup, prompt = null) {

    let promptsFormArray = script.controls.prompts as FormArray;
    let itemCode = "prompt_"+(promptsFormArray.length + 1);

    promptsFormArray.push(new FormGroup({
      name: new FormControl(prompt ? prompt.itemcode : itemCode, [
          Validators.required,
          Validators.minLength(3),
          Validators.pattern("[a-zA-Z0-9 \\\-_]*")
      ]),
      itemcode: new FormControl(prompt ? prompt.itemcode : itemCode),
      value: new FormControl(prompt ? prompt.mediaitems[0].text : "", [
          /*
          Validators.required,
          Validators.minLength(3),
          Validators.pattern("[a-zA-Z0-9 \\\-_]*")
          */
        ])
    }));
  }

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

  get scriptForms() {
    return this.form.get('scripts') as FormArray;
  }

  deleteSprScript(i, event) {
    const scripts = this.form.get('scripts') as FormArray;
    let script = scripts.controls[i] as FormGroup;

    //confirm deletion if not new
    if(!script.controls.new.value) {
      if(!confirm("Are you sure you want to delete this script? This will also make any recording sessions using this script unusable for new recordings.")) {
        return;
      }
    }

    //delete from server
    if(!script.controls.new.value) {
      this.projectService.deleteSprScript(script.controls.scriptId.value).subscribe((response:any) => {
        if(response.type == "cmd-result" && response.result != "OK") {
          this.notifierService.notify("error", "Failed to delete script.");
        }
      });
    }

    scripts.removeAt(i);
  }

  saveForm() {
    //set all controls to touched
    this.form.markAllAsTouched();

    //check that form is valid
    if(!this.form.valid) {
      this.notifierService.notify("error", "Form is not ready to be submitted. Please check for any errors.");
      return;
    }

    let user = this.userService.getSession();

    this.projectService.saveSprScripts(user.id, this.form.value.scripts).subscribe((response) => {
      this.projectManager.dashboard.modalActive = false;
    });
  }

  toggleSectionCollapsed(sectionName) {
    this.scripts.controls.forEach(group => {
      let g = group as FormGroup;
      if(sectionName == g.controls.name.value) {
        g.controls.collapsed.setValue(!g.controls.collapsed.value);
      }
    });
  }
  
}


