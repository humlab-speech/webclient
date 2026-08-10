import { Component, Input, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { NotifierService } from 'angular-notifier';
import { Role, PROJECT_ROLE_RESEARCHER } from 'src/app/models/Role';
import { Project } from 'src/app/models/Project';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';

/**
 * Invitation codes for one project.
 *
 * Every code invites someone into the project this dialog was opened from, with a
 * chosen project role, and optionally locked to a single EPPN. The project is
 * fixed at creation and cannot be changed afterwards - reassigning a code between
 * projects would let a project admin invite people into projects they do not
 * administer.
 */
@Component({
  selector: 'app-invite-codes-dialog',
  templateUrl: './invite-codes-dialog.component.html',
  styleUrls: ['./invite-codes-dialog.component.scss']
})
export class InviteCodesDialogComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  inviteCodesForm:FormGroup;
  showLoadingIndicator:boolean = true;
  loadFailed:boolean = false;
  isCreatingInviteCode:boolean = false;
  newInviteCodeForm:FormGroup;
  codeUrl:string = window.location.origin + '/invitecode/';
  grantableRoles:Role[] = [];

  constructor(
    private fb: FormBuilder,
    private userService:UserService,
    private notifierService: NotifierService
  ) { }

  ngOnInit(): void {
    if(!this.project) {
      this.project = this.projectManager?.projectInEdit ?? null;
    }

    this.buildForm();

    this.userService.fetchProjectRoles().subscribe((roles: Role[]) => {
      this.grantableRoles = roles.filter(role => role.grantableViaInviteCode);
    });

    if(!this.project?.id) {
      this.showLoadingIndicator = false;
      this.loadFailed = true;
      return;
    }

    this.userService.fetchInviteCodesByProject(String(this.project.id)).subscribe((response: any) => {
      this.showLoadingIndicator = false;
      (response.result || []).forEach((inviteCode: any) => {
        this.inviteCodes.push(this.buildInviteCodeGroup(inviteCode));
      });
    }, () => {
      this.showLoadingIndicator = false;
      this.loadFailed = true;
      this.notifierService.notify('error', 'Failed to load invite codes.');
    });
  }

  buildForm(): void {
    this.inviteCodesForm = this.fb.group({
      inviteCodes: this.fb.array([]),
    });

    // The role/eppn for the *next* code to be created. Existing codes carry their
    // own controls in the inviteCodes array.
    this.newInviteCodeForm = this.fb.group({
      role: [PROJECT_ROLE_RESEARCHER, Validators.required],
      eppn: [''],
    });
  }

  private buildInviteCodeGroup(inviteCode: any): FormGroup {
    return this.fb.group({
      code: [inviteCode.code, Validators.required],
      used: inviteCode.used,
      role: inviteCode.role || PROJECT_ROLE_RESEARCHER,
      eppn: inviteCode.eppn || '',
    });
  }

  get inviteCodes(): FormArray {
    return this.inviteCodesForm.get('inviteCodes') as FormArray;
  }

  get projectName(): string {
    return this.project?.name || '';
  }

  addInviteCode(): void {
    if (this.isCreatingInviteCode || !this.project?.id) {
      return;
    }

    const role = this.newInviteCodeForm.get('role').value || PROJECT_ROLE_RESEARCHER;
    const eppn = (this.newInviteCodeForm.get('eppn').value || '').trim();

    this.isCreatingInviteCode = true;
    this.userService.generateInviteCode(String(this.project.id), role, eppn || null).subscribe((response: any) => {
      this.isCreatingInviteCode = false;

      if(!response?.result) {
        this.notifierService.notify('error', response?.message || 'Failed to create invite code.');
        return;
      }

      this.inviteCodes.push(this.buildInviteCodeGroup({
        code: response.result,
        used: false,
        role: role,
        eppn: eppn,
      }));
      this.newInviteCodeForm.patchValue({ eppn: '' });
    }, () => {
      this.isCreatingInviteCode = false;
      this.notifierService.notify('error', 'Failed to create invite code.');
    });
  }

  /** Persist role/eppn edits of existing codes. */
  saveInviteCodes(): void {
    if(this.inviteCodes.length === 0) {
      return;
    }

    this.userService.updateInviteCodes(this.inviteCodes.value).subscribe((response: any) => {
      if(response?.result !== 'OK') {
        this.notifierService.notify('error', response?.message || 'Failed to update invite codes.');
      }
    }, () => {
      this.notifierService.notify('error', 'Failed to update invite codes.');
    });
  }

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

  copyInviteCode(index: number): void {
    let code = this.inviteCodes.at(index).get('code').value;
    let codeLink = this.codeUrl + code;

    if (navigator.clipboard && window.isSecureContext) {
      // use the Clipboard API if available and secure
      navigator.clipboard.writeText(codeLink).then(() => {
        this.notifierService.notify('info', 'Invite link copied to clipboard.');
      }).catch(err => {
        console.error('Could not copy text: ', err);
        this.notifierService.notify('error', 'Failed to copy invite link to clipboard.');
      });
    } else {
      // fallback for insecure context or unsupported browsers
      let textArea = document.createElement("textarea");
      textArea.value = codeLink;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copySuccessful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (copySuccessful) {
        this.notifierService.notify('info', 'Invite link copied to clipboard.');
      } else {
        this.notifierService.notify('error', 'Failed to copy invite link to clipboard.');
      }
    }
  }

  removeInviteCode(index: number): void {
    if(!confirm("Are you sure you want to delete this invite code?")) {
      return;
    }

    let code = this.inviteCodes.at(index).get('code').value;
    this.userService.deleteInviteCode(code).subscribe((response: any) => {
      if(response?.result !== 'OK') {
        this.notifierService.notify('error', response?.message || 'Failed to delete invite code.');
        return;
      }
      this.inviteCodes.removeAt(index);
    }, () => {
      this.notifierService.notify('error', 'Failed to delete invite code.');
    });
  }

  saveDialog() {
    if(this.inviteCodes.length === 0) {
      this.closeDialog();
      return;
    }

    this.userService.updateInviteCodes(this.inviteCodes.value).subscribe(() => {
      this.closeDialog();
    }, () => {
      this.notifierService.notify('error', 'Failed to save invite codes.');
    });
  }
}
