import { Component, Input, OnInit } from '@angular/core';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { Project } from "../../models/Project";
import { ProjectService } from '../../services/project.service';
import { UserService } from 'src/app/services/user.service';
import { NotifierService } from 'angular-notifier';
import { CreatedSprScript, EditableSprScript } from '../forms/spr-scripts-form/spr-scripts-form.component';

interface ManagedSprScript extends EditableSprScript {
  owner?: string;
  ownerId?: string;
}

@Component({
  selector: 'app-manage-spr-scripts-dialog',
  templateUrl: './manage-spr-scripts-dialog.component.html',
  styleUrls: ['./manage-spr-scripts-dialog.component.scss']
})
export class ManageSprScriptsDialogComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  scripts: ManagedSprScript[] = [];
  scriptsLoaded:boolean = false;
  editorOpen:boolean = false;
  scriptInEdit: ManagedSprScript = null;

  constructor(
    private projectService:ProjectService,
    private notifierService: NotifierService,
    private userService:UserService
    ) { }

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;
    this.fetchScripts();
  }

  fetchScripts() {
    this.scriptsLoaded = false;
    let user = this.userService.getSession();
    this.projectService.fetchSprScripts(user.username).subscribe((response:any) => {
      this.scripts = response.result.map((script) => this.toManagedScript(script));
      this.scriptsLoaded = true;
    });
  }

  canEditScript(script) {
    let user = this.userService.getSession();
    return (script.owner && script.owner == user.username) || (script.ownerId && script.ownerId == user.id);
  }

  addScript() {
    this.scriptInEdit = null;
    this.editorOpen = true;
  }

  editScript(script:ManagedSprScript) {
    if(!this.canEditScript(script)) {
      return;
    }
    this.scriptInEdit = {
      ...script,
      prompts: script.prompts.map(prompt => ({ ...prompt })),
    };
    this.editorOpen = true;
  }

  closeEditor() {
    this.editorOpen = false;
    this.scriptInEdit = null;
  }

  onScriptSaved(script:CreatedSprScript) {
    const wasEditing = this.scriptInEdit != null;
    this.closeEditor();
    this.fetchScripts();
    this.notifierService.notify("info", "Script '" + script.name + "' " + (wasEditing ? "saved." : "created."));
  }

  deleteSprScript(script:ManagedSprScript, event:Event = null) {
    event?.stopPropagation();
    if(!this.canEditScript(script)) {
      return;
    }
    if(!confirm("Are you sure you want to delete this script? This will also make any recording sessions using this script unusable for new recordings.")) {
      return;
    }

    this.projectService.deleteSprScript(script.scriptId).subscribe((response:any) => {
      if(response.type == "cmd-result" && response.result != "OK") {
        this.notifierService.notify("error", "Failed to delete script.");
        return;
      }
      this.scripts = this.scripts.filter(existing => existing.scriptId != script.scriptId);
      this.notifierService.notify("info", "Script deleted.");
    });
  }

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

  get existingScriptNames():string[] {
    return this.scripts.map(script => script.name);
  }

  get editorContextLabel():string {
    return this.scriptInEdit ? "Edit recording script" : "New recording script";
  }

  get editorSaveButtonLabel():string {
    return this.scriptInEdit ? "Save script" : "Create script";
  }

  get editorFooterNote():string {
    return this.scriptInEdit ? "Changes are saved right away and apply to future recording sessions." : "The script is saved right away and added to your recorder scripts.";
  }

  promptCount(script:ManagedSprScript):number {
    return script.prompts.filter(prompt => String(prompt.value || "").trim() != "").length;
  }

  private toManagedScript(script:any):ManagedSprScript {
    const promptItems = script.sections?.[0]?.groups?.[0]?.promptItems || [];
    return {
      scriptId: script.scriptId,
      name: script.name,
      sharing: script.sharing || "none",
      itemcodeSeq: Number(script.itemcodeSeq) || 0,
      owner: script.owner,
      ownerId: script.ownerId,
      prompts: promptItems.map((prompt, index) => ({
        itemcode: prompt.itemcode || "prompt_" + (index + 1),
        value: prompt.mediaitems?.[0]?.text || "",
      })),
    };
  }
  
}
