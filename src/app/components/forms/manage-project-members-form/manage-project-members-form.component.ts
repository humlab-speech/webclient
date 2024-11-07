import { Component, OnInit, Input } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import { Subscription, of } from 'rxjs';
import { ProjectService } from 'src/app/services/project.service';
import { SystemService } from 'src/app/services/system.service';
import { Project } from '../../../models/Project';
import { BundleListItem } from '../../../models/BundleListItem';
import { UserService } from 'src/app/services/user.service';
import { NotifierService } from 'angular-notifier';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { WebSocketMessage } from 'src/app/models/WebSocketMessage';

@Component({
  selector: 'app-manage-project-members-form',
  templateUrl: './manage-project-members-form.component.html',
  styleUrls: ['./manage-project-members-form.component.scss'],
})
export class ManageProjectMembersFormComponent implements OnInit {

  @Input() project: Project;

  private searchSubject = new Subject<string>();
  form:FormGroup;
  subscriptions:Subscription[] = [];
  submitBtnLabel:string = "Save";
  submitBtnEnabled:boolean = false;
  submitBtnEnabledLockout = false;
  showLoadingIndicator:boolean = false;
  loadingStatus:boolean = true;
  displayDespiteNotLoading:boolean = false;
  loadingMessage:string = "Loading Status";
  searchUsers:any = [];
  addMemberDialogShown:boolean = false;
  notifierService:NotifierService;

  constructor(private fb:FormBuilder, private projectService:ProjectService, private systemService:SystemService, private userService:UserService, notifierService: NotifierService) {
    this.notifierService = notifierService;
  }

  get tree(): FormArray {
    return this.form.get('tree') as FormArray;
  }
  
  ngOnInit(): void {
    this.setLoadingStatus(true, "Loading users");

    this.form = this.fb.group({
      members: this.fb.array([]),
    });

    this.project.members.forEach((member) => {
      (this.form.get('members') as FormArray).push(this.fb.group({
        username: member.username,
        firstName: member.firstName,
        lastName: member.lastName,
        fullName: member.firstName + " " + member.lastName,
        eppn: member.eppn,
        role: member.role,
        selected: false
      }));
    });
    
    this.form.addControl("searchUser", new FormControl());

    this.subscriptions.push(
      // any time the inner form changes update the parent of any change
      this.form.valueChanges.subscribe(value => {
        this.onChange(value);
        this.onTouched();
      })
    );

    this.setLoadingStatus(false);

    this.searchSubject.pipe(
      debounceTime(300),
      switchMap(searchValue => this.performUserSearch(searchValue))
    ).subscribe();

  
}

  get members(): FormArray {
    return this.form.get('members') as FormArray;
  }

  onInput(event: any): void {
    const searchValue = event.target.value;
    this.searchSubject.next(searchValue);
  }

  performUserSearch(searchValue: string): Promise<any> {
    return new Promise((resolve) => {
      if (searchValue.length > 2) {
        this.systemService.sendCommandToBackend({
          cmd: "searchUsers",
          searchValue: searchValue
        }).then((msg:WebSocketMessage) => {
          this.searchUsers = msg.data.data;
          if (this.searchUsers.length > 0) {
            document.getElementById("user-select-options").style.display = "block";
          } else {
            document.getElementById("user-select-options").style.display = "none";
          }
        }).finally(() => resolve(null));
      } else {
        // Hide options if searchValue is less than 3 characters
        document.getElementById("user-select-options").style.display = "none";
        resolve(null);
      }
    });
  }

  userIsProjectAdmin() {
    let userSession = this.userService.getSession();
    let result = false;
    this.project.members.forEach((member) => {
      if(member.username == userSession.username && member.role == "admin") {
        result = true;
      }
    });
    return result;
  }

  onChange(value) {
  }
  onTouched() {
  }

  setLoadingStatus(isLoading = true, msg = "Saving", displayDespiteNotLoading = false) {
    this.displayDespiteNotLoading = displayDespiteNotLoading;
    this.loadingStatus = isLoading;
    this.loadingMessage = msg;
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = msg;
    }
    else {
      //this.submitBtnEnabled = false;
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Save";
      this.submitBtnEnabled = true;
    }
  }

  toggleMemberSearch() {
    let searchBox = document.getElementById("search-user-input");
    if(!this.addMemberDialogShown) {
      searchBox.style.display = "flex";
      searchBox.style.opacity = "1.0";
      searchBox.style.maxWidth = "100%";
      this.addMemberDialogShown = true;
      document.getElementById("search-user-control").focus();
    }
    else {
      searchBox.style.display = "none";
      searchBox.style.opacity = "0.0";
      searchBox.style.maxWidth = "0%";
      this.addMemberDialogShown = false;
    }
  }

  updateRole(user) {
    //check that this user is not the last admin user on the project
    let numAdmins = 0;
    this.members.controls.forEach((member) => {
      if(member.value.role == "admin") {
        numAdmins++;
      }
    });
    if(numAdmins == 0 && user.value.role == "member") {
      this.notifierService.notify("error", "The project needs to have at least one admin user");
      user.get('role').setValue("admin");
      return;
    }

    this.systemService.sendCommandToBackend({
      cmd: "updateProjectMemberRole",
      projectId: this.project.id,
      username: user.value.username,
      role: user.value.role
    }).then((wsMsg:WebSocketMessage) => {
      if(wsMsg.progress == "end" && wsMsg.result) {
        this.notifierService.notify("info", "Updated role for "+user.value.fullName);
        this.projectService.fetchProjects(true).subscribe((projects) => {});
      }
      else {
        this.notifierService.notify("error", "Failed to update role for "+user.value.fullName);
      }
    });
  }

  addMember(user) {
    //Add this user as a member to the project
    this.systemService.sendCommandToBackend({
      cmd: "addProjectMember",
      projectId: this.project.id,
      username: user.username
    }).then((wsMsg:WebSocketMessage) => {
      if(wsMsg.progress == "end" && !wsMsg.result) {
        this.notifierService.notify("error", wsMsg.message);
        return;
      }

      this.toggleMemberSearch();
      (<HTMLInputElement>document.getElementById("search-user-control")).value = "";
      this.searchUsers = [];

      if(wsMsg.progress == "end" && wsMsg.result) {
        this.notifierService.notify("info", "Added "+user.fullName+" to the project");
        this.members.push(this.fb.group({
          username: wsMsg.data.user.username,
          firstName: wsMsg.data.user.firstName,
          lastName: wsMsg.data.user.lastName,
          fullName: wsMsg.data.user.firstName + " " + wsMsg.data.user.lastName,
          eppn: wsMsg.data.user.eppn,
          role: "member",
          selected: false
        }));

        this.projectService.fetchProjects(true).subscribe((projects) => {});
      }

    });
  }

  removeMember(user) {
    //check that this user is not the last admin user on the project
    let numAdmins = 0;
    this.members.controls.forEach((member) => {
      if(member.value.role == "admin") {
        numAdmins++;
      }
    });
    if(numAdmins < 2 && user.value.role == "admin") {
      this.notifierService.notify("error", "Cannot remove last admin user from project");
      return;
    }

    if(window.confirm('Really remove member '+user.value.fullName+' from the project?')) {
      this.systemService.sendCommandToBackend({
        cmd: "removeProjectMember",
        projectId: this.project.id,
        username: user.value.username
      }).then((wsMsg:WebSocketMessage) => {
        if(wsMsg.progress == "end" && wsMsg.result) {
          this.notifierService.notify("info", "Removed member "+user.value.fullName+" from the project");
          this.members.removeAt(this.members.controls.indexOf(user));
          this.projectService.fetchProjects(true).subscribe((projects) => {});
        }
        else {
          this.notifierService.notify("error", wsMsg.message);
        }
        
      });
    }
  }

  validateForm() {
    console.log("validateForm");
    return true;
  }

  setSaveFormStatus(statusText:string) {
    this.submitBtnLabel = statusText;
  }

  async saveForm() {
    this.submitBtnEnabled = false;
    this.setSaveFormStatus("Saving");

    this.form.value.members.forEach((member) => {
      console.log(member);
    });

    /*
    this.systemService.sendCommandToBackend({
      cmd: "saveBundleLists",
      projectId: this.project.id,
      bundleLists: bundleLists
    }).then((data) => {
      this.setSaveFormStatus("Saved");
      this.submitBtnEnabled = true;
    });
    */
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

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

}
