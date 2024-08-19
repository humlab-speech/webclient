import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { ProjectService } from 'src/app/services/project.service';

@Component({
  selector: 'app-invite-codes-dialog',
  templateUrl: './invite-codes-dialog.component.html',
  styleUrls: ['./invite-codes-dialog.component.scss']
})
export class InviteCodesDialogComponent implements OnInit {

  inviteCodesForm:FormGroup;
  showLoadingIndicator:boolean = true;
  codeUrl:string = window.location.origin + '/invitecode/';

  constructor(private fb: FormBuilder, private userService:UserService, private modalService: ModalService, private projectService:ProjectService) { }

  ngOnInit(): void {
    this.buildForm();

    this.userService.fetchInviteCodesByUser().subscribe((response: any) => {
      this.showLoadingIndicator = false;
      response.result.forEach((inviteCode: any) => {
        let inviteCodes = this.inviteCodesForm.get('inviteCodes') as FormArray;
        
        const projectIdsArray = inviteCode.projectIds || [];
        const projectIdsFormArray = this.fb.array(
          projectIdsArray.map((projectId: string) => this.fb.control(projectId))
        );

        inviteCodes.push(this.fb.group({ 
          code: [inviteCode.code, Validators.required],
          used: inviteCode.used,
          projectIds: projectIdsFormArray,
          projectId: projectIdsArray[0] || null,
        }));
      });
    });
  }

  buildForm(): void {
    this.inviteCodesForm = this.fb.group({
      inviteCodes: this.fb.array([]),
    });
  }

  get projects(): any {
    let projects = this.projectService.getProjects().slice(); // Create a copy using slice()
    projects.unshift({ id: null, name: 'None' });
    return projects;
  }

  get inviteCodes(): FormArray {
    return this.inviteCodesForm.get('inviteCodes') as FormArray;
  }

  addInviteCode(): void {
    this.userService.generateInviteCode().subscribe((response: any) => {
      let inviteCodes = this.inviteCodesForm.get('inviteCodes') as FormArray;
      inviteCodes.push(this.fb.group({ 
        code: [response.result, Validators.required],
        used: false,
        projectIds: this.fb.array([]),
        projectId: null,
      }));
    });
  }

  onProjectSelected(event: any, codeControl: FormControl): void {
    let projectIds = codeControl.get('projectIds') as FormArray;

    // Create a new FormControl with the selected project ID
    const selectedProjectId = event.target.value;
    const projectIdControl = new FormControl(selectedProjectId);

    //clear projectIds
    projectIds.clear();

    // Add the new FormControl to the projectIds FormArray
    if(projectIdControl.value != "null") {
      projectIds.push(projectIdControl);
    }

    //send update to the backend
    let inviteCodes = this.inviteCodesForm.get('inviteCodes') as FormArray;
    let inviteCodesData = inviteCodes.value;
    this.userService.updateInviteCodes(inviteCodesData).subscribe((response: any) => {
      console.log(response);
    });
}

  closeDialog() {
    this.modalService.hideModal("invite-codes-dialog");
  }

  copyInviteCode(index: number): void {
    let inviteCodes = this.inviteCodesForm.get('inviteCodes') as FormArray;
    let code = inviteCodes.at(index).get('code').value;
  
    if (navigator.clipboard && window.isSecureContext) {
      // use the Clipboard API if available and secure
      navigator.clipboard.writeText(code).then(() => {
        console.log('Invite code copied to clipboard');
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    } else {
      // fallback for insecure context or unsupported browsers
      let textArea = document.createElement("textarea");
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('Fallback: Invite code copied to clipboard');
    }
  }

  removeInviteCode(index: number): void {
    if(!confirm("Are you sure you want to delete this invite code?")) {
      return;
    }

    let inviteCodes = this.inviteCodesForm.get('inviteCodes') as FormArray;
    let code = inviteCodes.at(index).get('code').value;
    this.userService.deleteInviteCode(code).subscribe((response: any) => {
      inviteCodes.removeAt(index);
    });
  }

  saveDialog() {
    let inviteCodes = this.inviteCodesForm.get('inviteCodes') as FormArray;
    let inviteCodesData = inviteCodes.value;
    this.userService.updateInviteCodes(inviteCodesData).subscribe((response: any) => {
      this.modalService.hideModal("invite-codes-dialog");
    });
  }
}
