import { Component, ElementRef, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { NotifierService } from 'angular-notifier';
import { nanoid } from 'nanoid';
import { ProjectService } from 'src/app/services/project.service';
import { UserService } from 'src/app/services/user.service';

export interface SprScriptPrompt {
  itemcode?: string;
  value: string;
}

export interface EditableSprScript {
  scriptId?: string;
  name?: string;
  sharing?: string;
  prompts?: SprScriptPrompt[];
}

export interface CreatedSprScript {
  scriptId: string;
  name: string;
}

// Item codes name the recorded takes (<itemcode>.wav in the session's upload dir),
// so they belong to the prompt rather than to its position: adding, removing or
// pasting prompts must not renumber them, and a number this script already used
// must not come back into service - the recorder would record over the older take,
// and importing the new one replaces that bundle, annotations included.
// Same pattern the recorder itself enforces (wsrng-server src/main.js).
export const ITEM_CODE_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * The code list for a loaded script: codes that are usable are kept exactly as
 * saved, everything else (a script saved before item codes existed, a code the
 * recorder would reject, or a duplicate of an earlier prompt) gets a fresh number
 * above the highest one this script ever used. `seq` is where numbering continues.
 */
export function normalizeItemcodes(prompts: SprScriptPrompt[]): { codes: string[], seq: number, used: string[] } {
  const loaded = prompts.map(p => String(p.itemcode || "").trim());
  const used = new Set<string>(loaded.filter(c => c != ""));
  let seq = 0;
  loaded.forEach(code => {
    const numbered = /^prompt_(\d+)$/.exec(code);
    if (numbered) {
      seq = Math.max(seq, parseInt(numbered[1], 10));
    }
  });
  const nextFresh = () => {
    while (used.has("prompt_" + (seq + 1))) {
      seq++;
    }
    seq++;
    used.add("prompt_" + seq);
    return "prompt_" + seq;
  };
  const seen = new Set<string>();
  const codes = loaded.map(code => {
    if (code != "" && ITEM_CODE_PATTERN.test(code) && !seen.has(code)) {
      seen.add(code);
      return code;
    }
    const fresh = nextFresh();
    seen.add(fresh);
    return fresh;
  });
  return { codes, seq, used: Array.from(used) };
}

/**
 * Creates or edits a single speech recorder script in place, on top of whichever dialog
 * needs one, so the user never has to leave (and lose) the form they are in.
 * The script is saved to the backend as soon as it is submitted; the caller only
 * has to decide what to do with the saved scriptId.
 */
@Component({
  selector: 'app-spr-scripts-form',
  templateUrl: './spr-scripts-form.component.html',
  styleUrls: ['./spr-scripts-form.component.scss']
})
export class SprScriptsFormComponent implements OnInit {
  // Names of the scripts the user can already see, to catch duplicates early
  @Input() existingScriptNames: string[] = [];
  // Existing script data turns the sheet into edit mode
  @Input() script: EditableSprScript = null;
  // Recording session the script is created for, shown for context only
  @Input() sessionName: string = null;
  @Input() contextLabel: string = "New recording script";
  @Input() saveButtonLabel: string = "Create script";
  @Input() savingButtonLabel: string = "Saving...";
  @Input() footerNote: string = "The script is saved right away and selected for this session.";
  @Output() created = new EventEmitter<CreatedSprScript>();
  @Output() saved = new EventEmitter<CreatedSprScript>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  isSaving: boolean = false;
  submitted: boolean = false;
  private originalName: string = "";
  // Item codes name the recorded takes (<itemcode>.wav), so they belong to the
  // prompt: they travel with it, are not renumbered when prompts are added,
  // removed or pasted, and are never re-used below the highest number this
  // script already carries (see normalizeItemcodes).
  private itemcodes: string[] = [];
  private usedItemcodes = new Set<string>();
  private itemcodeSeq = 0;

  constructor(
    private elementRef: ElementRef,
    private projectService: ProjectService,
    private userService: UserService,
    private notifierService: NotifierService,
  ) { }

  ngOnInit(): void {
    this.originalName = String(this.script?.name || "").trim();
    const initialPrompts = this.script?.prompts?.length ? this.script.prompts : [{ value: "" }];
    const itemcodes = normalizeItemcodes(initialPrompts);
    this.itemcodes = itemcodes.codes;
    this.itemcodeSeq = itemcodes.seq;
    itemcodes.used.forEach(code => this.usedItemcodes.add(code));
    this.form = new FormGroup({
      name: new FormControl(this.script?.name || "", [
        Validators.required,
        Validators.minLength(3),
        Validators.pattern("[a-zA-Z0-9 \\\-_]*"),
        this.validateNameUnique.bind(this),
      ]),
      sharing: new FormControl(this.script?.sharing || "none"),
      prompts: new FormArray(initialPrompts.map(prompt => new FormControl(prompt.value || "")), this.validateHasPrompt),
    });
    setTimeout(() => this.focusElement(".script-name-input"), 0);
  }

  get name() {
    return this.form.get('name');
  }

  get prompts() {
    return this.form.get('prompts') as FormArray;
  }

  get promptCount(): number {
    return this.prompts.controls.filter(c => String(c.value || "").trim() != "").length;
  }

  validateNameUnique(control: AbstractControl): ValidationErrors | null {
    const name = String(control.value || "").trim().toLowerCase();
    if(name == this.originalName.toLowerCase()) {
      return null;
    }
    const taken = this.existingScriptNames.some(n => String(n).trim().toLowerCase() == name);
    return taken ? { scriptNameTaken: true } : null;
  }

  validateHasPrompt(control: AbstractControl): ValidationErrors | null {
    const hasPrompt = (control.value as string[]).some(v => String(v || "").trim() != "");
    return hasPrompt ? null : { noPrompts: true };
  }

  newItemcode(): string {
    let code = "";
    while(code == "" || this.usedItemcodes.has(code)) {
      this.itemcodeSeq++;
      code = "prompt_" + this.itemcodeSeq;
    }
    this.usedItemcodes.add(code);
    return code;
  }

  addPrompt(afterIndex: number = this.prompts.length - 1, value = "") {
    this.prompts.insert(afterIndex + 1, new FormControl(value));
    this.itemcodes.splice(afterIndex + 1, 0, this.newItemcode());
    this.focusPrompt(afterIndex + 1);
  }

  removePrompt(index: number) {
    if(this.prompts.length > 1) {
      this.prompts.removeAt(index);
      this.itemcodes.splice(index, 1);
      this.focusPrompt(Math.max(0, index - 1));
    }
    else {
      this.prompts.at(0).setValue("");
    }
  }

  onPromptEnter(index: number, event: Event) {
    event.preventDefault();
    this.addPrompt(index);
  }

  onPromptBackspace(index: number, event: Event) {
    if(this.prompts.length > 1 && String(this.prompts.at(index).value || "") == "") {
      event.preventDefault();
      this.removePrompt(index);
    }
  }

  /**
   * Pasting several lines turns each line into a prompt, so an existing list
   * (from a document or spreadsheet) can be brought in in one go.
   */
  onPromptPaste(index: number, event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text") || "";
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l != "");
    if(lines.length < 2) {
      return;
    }
    event.preventDefault();

    const control = this.prompts.at(index);
    let insertAt = index;
    if(String(control.value || "").trim() == "") {
      control.setValue(lines.shift());
    }
    lines.forEach(line => {
      insertAt++;
      this.prompts.insert(insertAt, new FormControl(line));
      this.itemcodes.splice(insertAt, 0, this.newItemcode());
    });
    this.focusPrompt(insertAt);
  }

  cancel() {
    if(this.isSaving) {
      return;
    }
    const hasContent = String(this.name.value || "").trim() != "" || this.promptCount > 0;
    const shouldConfirm = this.script ? this.form.dirty : hasContent;
    const confirmMessage = this.script ? "Discard changes?" : "Discard this script?";
    if(shouldConfirm && !window.confirm(confirmMessage)) {
      return;
    }
    this.cancelled.emit();
  }

  save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if(this.form.invalid || this.isSaving) {
      return;
    }

    const user = this.userService.getSession();
    const script = {
      scriptId: this.script?.scriptId || nanoid(),
      name: String(this.name.value).trim(),
      sharing: this.form.value.sharing,
      prompts: this.prompts.controls
        .map((control, i) => ({ code: this.itemcodes[i] || this.newItemcode(), value: String(control.value || "").trim() }))
        .filter(prompt => prompt.value != "")
        .map(prompt => ({ name: prompt.code, itemcode: prompt.code, value: prompt.value })),
    };

    this.isSaving = true;
    this.projectService.saveSprScripts(user.username, [script]).subscribe({
      next: () => {
        this.isSaving = false;
        this.created.emit({ scriptId: script.scriptId, name: script.name });
        this.saved.emit({ scriptId: script.scriptId, name: script.name });
      },
      error: () => {
        this.isSaving = false;
        this.notifierService.notify("error", "Could not save the script. Please try again.");
      },
    });
  }

  focusPrompt(index: number) {
    setTimeout(() => {
      const inputs = this.elementRef.nativeElement.querySelectorAll(".prompt-input");
      inputs[index]?.focus();
    }, 0);
  }

  private focusElement(selector: string) {
    this.elementRef.nativeElement.querySelector(selector)?.focus();
  }
}
