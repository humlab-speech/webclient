import { Component, OnInit, Input } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from '../../../models/Project';
import { BundleListItem } from '../../../models/BundleListItem';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-manage-project-members-form',
  templateUrl: './manage-project-members-form.component.html',
  styleUrls: ['./manage-project-members-form.component.scss']
})
export class ManageProjectMembersFormComponent implements OnInit {

  @Input() project: Project;

  //project: Project;
  form:FormGroup;
  subscriptions:Subscription[] = [];
  submitBtnLabel:string = "Save";
  submitBtnEnabled:boolean = true;
  submitBtnEnabledLockout = false;
  showLoadingIndicator:boolean = false;
  loadingStatus:boolean = true;
  loadingMessage:string = "Loading Status";
  sessionAccessCode:string = null;
  projectMembers:any = [];
  searchUsers:any = [];
  addMemberDialogShown:boolean = false;
  bundleLists:BundleListItem[] = [];
  emuDb:any = {
    bundles: []
  };

  constructor(private fb:FormBuilder, private projectService:ProjectService, private userService:UserService) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      projectMembers: this.fb.array([])
    });

    this.form.addControl("searchUser", new FormControl());

    this.subscriptions.push(
      // any time the inner form changes update the parent of any change
      this.form.valueChanges.subscribe(value => {
        this.onChange(value);
        this.onTouched();
      })
    );

    this.setLoadingStatus(true, "Loading users & bundle lists");
    this.loadData().then(() => {
      this.setLoadingStatus(false);
    });
  }

  userIsProjectMaintainer() {
    for(let key in this.projectMembers) {
      if(this.projectMembers[key].username == this.userService.getSession().username && this.projectMembers[key].access_level > 30) {
        return true;
      }
    }
    return false;
  }

  onChange(value) {
    console.log("change", value);
  }
  onTouched() {
    console.log("touched");
  }

  setLoadingStatus(isLoading = true, msg = "Saving") {
    this.loadingStatus = isLoading;
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = msg;
      this.submitBtnEnabledLockout = true;
    }
    else {
      this.submitBtnEnabled = true;
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Save";
      this.submitBtnEnabledLockout = false;
    }
  }

  getBundleList(username) {
    for(let key in this.projectMembers) {
      let member = this.projectMembers[key];
      if(member.username == username) {
        return member.bundleList;
      }
    }
    return null;
  }

  getBundleFromMemberBundleList(username, sessionName, bundleName):BundleListItem {
    for(let key in this.projectMembers) {
      let member = this.projectMembers[key];
      if(member.username == username) {
        for(let bundleKey in member.bundleList) {
          let bundleItem:BundleListItem = member.bundleList[bundleKey];
          if(bundleItem.name == bundleName && bundleItem.session == sessionName) {
            return bundleItem;
          }
        }
      } 
    }
    return null;
  }

  memberHasBundle(username, sessionName, bundleName) {
    let bundleItem:BundleListItem = this.getBundleFromMemberBundleList(username, sessionName, bundleName);
    return bundleItem == null ? false : bundleItem;
  }

  async loadData() {
    let projectSessions = null;

    await new Promise<void>((resolve, reject) => {
      this.projectService.fetchProjectSessions(this.project.id).subscribe(sessions => {
        projectSessions = sessions;
        resolve();
      });
    });

    let projectSessionsFormArray = new FormArray([]);
    projectSessions.forEach(session => {
      let bundlesFormArray = new FormArray([]);
      session.bundles.forEach(bundle => {
        bundlesFormArray.push(new FormControl(bundle))
      });

      let sessionFormControl = new FormGroup({
        sessionName: new FormControl(session.sessionName),
        sessionDir: new FormControl(session.sessionDir),
        bundles: bundlesFormArray
      });

      projectSessionsFormArray.push(sessionFormControl);
    });

    await new Promise<void>((resolve, reject) => {
      this.projectMemberForms.clear();
      this.projectService.fetchProjectMembers(this.project.id).subscribe(members => {
        
        members.forEach(member => {
          let memberFormGroup = new FormGroup({
            "member": new FormControl(member),
            "sessions": projectSessionsFormArray
          });

          this.projectMemberForms.push(memberFormGroup);
          
        });        
        
        this.projectMembers = members;
        //Try to get the bundleList of each project member
        this.projectMembers.forEach(member => {
          member.bundles = [];
          this.projectService.fetchBundleList(this.project, member.username).subscribe(bundleListResponse => {
            let bundleList = JSON.parse(atob(bundleListResponse.content));
            member.bundleList = bundleList;
            member.createBundleList = false;
          }, err => {
            if(err.status == 404) {
              //Bund list not found for this member, which is fine
              console.log("No bundlelist found for "+member.username);
              member.bundleList = [];
              member.createBundleList = true;
            }
          });
        });
        
        resolve();
        
      });
    });

  }

  bundleClicked(username, sessionName, bundleName, evt) {

    let bundleItem:BundleListItem = this.getBundleFromMemberBundleList(username, sessionName, bundleName);

    if(evt.target.checked) {
      if(!bundleItem) {
        let bundleList = this.getBundleList(username);
        let bundleListItem = new BundleListItem();
        bundleListItem.session = sessionName;
        bundleListItem.name = bundleName;
        bundleList.push(bundleListItem);
      }
    }
    else {
      if(bundleItem) {
        let bundleList = this.getBundleList(username);
        for(let key in bundleList) {
          let bundleItem:BundleListItem = bundleList[key];
          if(bundleItem.session == sessionName && bundleItem.name == bundleName) {
            bundleList.splice(key, 1);
            return;
          }
        }
      }
    }
  }

  toggleMemberSearch() {
    if(!this.addMemberDialogShown) {
      document.getElementById("search-user-input").style.display = "flex";
      document.getElementById("search-user-input").style.opacity = "1.0";
      document.getElementById("search-user-input").style.maxWidth = "100%";
      this.addMemberDialogShown = true;
    }
    else {
      document.getElementById("search-user-input").style.display = "none";
      document.getElementById("search-user-input").style.opacity = "0.0";
      document.getElementById("search-user-input").style.maxWidth = "0%";
      this.addMemberDialogShown = false;
    }
  }

  addMember(user) {
    //Add this user as a member to the project
    this.projectService.addProjectMember(this.project.id, user.id).subscribe(() => {
      this.loadData();
    });
    this.toggleMemberSearch();
    (<HTMLInputElement>document.getElementById("search-user-control")).value = "";
    this.searchUsers = [];
  }

  removeMember(user) {
    if(window.confirm('Really remove member '+user.name+'?')) {
      this.projectService.removeProjectMember(this.project.id, user.id).subscribe(() => {
        this.loadData();
      });
    }
  }

  searchUser(evt) {
    let searchValue = evt.target.value;
    if(searchValue == "") {
      document.getElementById("user-select-options").style.display = "none";
      return;
    }
    this.userService.searchUser(searchValue).subscribe(users => {
      this.searchUsers = users;
      if(this.searchUsers.length > 0) {
        document.getElementById("user-select-options").style.display = "block";
      }
      else {
        document.getElementById("user-select-options").style.display = "none";
      }
      console.log(users);
    });
  }

  validateForm() {
    console.log("validateForm");
   return true;
  }

  get projectMemberForms() {
    return this.form.get('projectMembers') as FormArray;
  }

  setSaveFormStatus(statusText:string) {
    this.submitBtnLabel = statusText;
  }

  setSaveButtonEnabled(enabled = true) {
    let value = enabled ? "true" : "false";
    let buttonEl = document.getElementById("member-form-save-button");
    buttonEl.setAttribute("disabled", value);
    this.submitBtnEnabled = enabled;
  }
  async saveForm() {
    this.setLoadingStatus(true);
    this.setTaskProgress(1, 1, "member-form-save-button", "Saving");

    if(this.sessionAccessCode == null) {
      this.setTaskProgress(1, 1, "member-form-save-button", "Creating container");

      await new Promise<void>((resolve, reject) => {
        //Get us an op-container
        this.projectService.fetchSession(this.project).subscribe(msg => {
          let apiResponse = JSON.parse(msg.data);

          if(apiResponse.type == "cmd-result" && apiResponse.cmd == "fetchSession" && apiResponse.progress != "end") {
            this.setTaskProgress(1, 1, "member-form-save-button", apiResponse.result);
          }

          if(apiResponse.type == "cmd-result" && apiResponse.cmd == "fetchSession" && apiResponse.progress == "end") {
            this.sessionAccessCode = apiResponse.result;
            //this.setSaveFormStatus(apiResponse.result);
            this.setTaskProgress(1, 1, "member-form-save-button", apiResponse.result);
            resolve();
          }
        });
      });
    }
    //this.setSaveFormStatus("Updating bundle lists");
    this.setTaskProgress(1, 1, "member-form-save-button", "Updating bundle lists");

    this.projectService.updateBundleLists(this.sessionAccessCode, this.projectMembers).subscribe(msg => {
      console.log(JSON.parse(msg.data));
      //this.setSaveFormStatus("Done!");
      this.setTaskProgress(1, 1, "member-form-save-button", "Done!");
      //this.showLoadingIndicator = false;
      this.setLoadingStatus(false);
    });
    
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


  shutdownSession() {
    if(this.sessionAccessCode != null) {
      this.projectService.shutdownSession(this.sessionAccessCode).subscribe(msg => {
        console.log(msg);
      });
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

}
