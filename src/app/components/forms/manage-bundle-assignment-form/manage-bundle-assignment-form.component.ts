import { Component, OnInit, Input } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProjectService } from 'src/app/services/project.service';
import { SystemService } from 'src/app/services/system.service';
import { Project } from '../../../models/Project';
import { BundleListItem } from '../../../models/BundleListItem';
import { UserService } from 'src/app/services/user.service';
import { NotifierService } from 'angular-notifier';
import { WebSocketMessage } from 'src/app/models/WebSocketMessage';

@Component({
  selector: 'app-manage-bundle-assignment-form',
  templateUrl: './manage-bundle-assignment-form.component.html',
  styleUrls: ['./manage-bundle-assignment-form.component.scss']
})
export class ManageBundleAssignmentFormComponent implements OnInit {
  
  @Input() project: Project;

  //project: Project;
  form:FormGroup;
  subscriptions:Subscription[] = [];
  submitBtnLabel:string = "Save";
  submitBtnEnabled:boolean = false;
  submitBtnEnabledLockout = false;
  showLoadingIndicator:boolean = false;
  loadingStatus:boolean = true;
  displayDespiteNotLoading:boolean = false;
  loadingMessage:string = "Loading Status";
  sessionAccessCode:string = null;
  projectMembers:any = [];
  searchUsers:any = [];
  addMemberDialogShown:boolean = false;
  bundleLists:BundleListItem[] = [];
  emuDb:any = {
    bundles: []
  };

  notifierService:NotifierService;


  constructor(private fb:FormBuilder, private projectService:ProjectService, private systemService:SystemService, private userService:UserService, notifierService: NotifierService) {
    this.notifierService = notifierService;
  }


  get tree(): FormArray {
    return this.form.get('tree') as FormArray;
  }
  

  ngOnInit(): void {
    this.setLoadingStatus(true, "Loading users & bundle lists");
    
    this.form = this.fb.group({
      members: this.fb.array([]),
    });

    this.project.members.forEach((member) => {

      let sessionsFormArray = new FormArray([]);
      this.project.sessions.forEach((session) => {
        let bundlesFormArray = new FormArray([]);
        session.files.forEach((file) => {
          bundlesFormArray.push(new FormGroup({
            name: new FormControl(file.name),
            selected: new FormControl(false),
            finishedEditing: new FormControl(false),
            comment: new FormControl('')
          }));
        });
        sessionsFormArray.push(new FormGroup({
          name: new FormControl(session.name),
          state: new FormControl(false),
          bundles: bundlesFormArray
        }));
      });

      (this.form.get('members') as FormArray).push(this.fb.group({
        username: member.username,
        fullName: member.firstName + " " + member.lastName,
        eppn: member.eppn,
        role: member.role,
        bundleList: this.fb.array([]),
        sessions: sessionsFormArray
      }));
    });
    
    this.mergeInBundlelists();

    this.form.addControl("searchUser", new FormControl());

    this.subscriptions.push(
      // any time the inner form changes update the parent of any change
      this.form.valueChanges.subscribe(value => {
        this.onChange(value);
        this.onTouched();
      })
    );

  }

  async mergeInBundlelists() {

    for(let key in this.project.members) {
      let member = this.project.members[key];
      let bundleListResponse:WebSocketMessage = await this.fetchBundleList(member.username);

      if(bundleListResponse.data == null) {
        this.notifierService.notify("warning", "Couldn't fetch bundle list for user "+member.username);
        continue;
      }

      (this.form.get('members') as FormArray).controls.forEach((memberGroup, memberIndex) => {
        console.log(memberGroup.get('username').value, member.username);
        if(memberGroup.get('username').value != member.username) {
          return;
        }
        bundleListResponse.data.bundles.forEach((bundleListItem) => {
          (memberGroup.get('sessions') as FormArray).controls.forEach((sessionGroup, sessionIndex) => {
            let sessionName = sessionGroup.get('name').value;
            if(bundleListItem.session == sessionName) {
              let bundlesFormArray = sessionGroup.get('bundles') as FormArray;
              bundlesFormArray.controls.forEach((bundleGroup, bundleIndex) => {
                let bundleName = bundleGroup.get('name').value;
                console.log(bundleListItem);
                if(bundleListItem.name+".wav" == bundleName) {
                  
                  bundleGroup.get('selected').setValue(true);
                  bundleGroup.get('finishedEditing').setValue(bundleListItem.finishedEditing);
                  bundleGroup.get('comment').setValue(bundleListItem.comment);
                }
              });
            }
          });
        });
      });
    }

    //check indeterminate state of all session checkboxes
    (this.form.get('members') as FormArray).controls.forEach((memberGroup, memberIndex) => {
      (memberGroup.get('sessions') as FormArray).controls.forEach((sessionGroup, sessionIndex) => {
        this.updateSessionIndeterminateState(memberGroup, sessionIndex);
      });
    });

    this.setLoadingStatus(false);
  }
  

  isIndeterminate(member, bundleControls) {
    let selectedNum = 0;

    bundleControls.forEach(bundle => {
      let fg = bundle as FormGroup;
      if(fg.value.selected) {
        selectedNum++;
      }
    });

    //if some bundles are checked and some are not, return true
    
    return selectedNum != 0 && selectedNum < bundleControls.length;
  }

  get members(): FormArray {
    return this.form.get('members') as FormArray;
  }

  sessionName(session: FormGroup): string {
    return session.get('name').value;
  }

  onSessionItemCheckboxChange(member, sessionIndex: number) {
    //change selection state of all underlying bundle checkboxes
    const bundleItems = member.controls.sessions.controls[sessionIndex].get('bundles') as FormArray;
    const sessionControl = member.controls.sessions.controls[sessionIndex].get('state');
    const sessionChecked = sessionControl?.value;
    
    bundleItems.controls.forEach(control => {
      control.get('selected')?.setValue(sessionChecked);
    });
  }

  // Method to handle checking/unchecking bundleItem checkboxes
  onBundleItemCheckboxChange(member, memberIndex:number, sessionIndex: number, bundleIndex:number) {
    this.updateSessionIndeterminateState(member, sessionIndex);
  }

  // Update the session checkbox's indeterminate state
  updateSessionIndeterminateState(member, sessionIndex: number) {
    const sessionGroup = member.controls.sessions.controls[sessionIndex];

    const bundleItems = sessionGroup.get('bundles') as FormArray;
    const sessionControl = sessionGroup.get('state');
    const allChecked = bundleItems.controls.every(control => control.value.selected);
    const someChecked = bundleItems.controls.some(control => control.value.selected);

    if (!allChecked && someChecked) {
      sessionControl?.setValue(false);
      sessionControl?.markAsTouched();
      sessionControl?.markAsDirty();
      sessionControl?.setErrors({ 'indeterminate': true });
      //console.log('indeterminate');
      //stateCtrl.setValue('indeterminate');
    } else if (allChecked) {
      sessionControl?.setValue(true);
      sessionControl?.markAsTouched();
      sessionControl?.markAsDirty();
      sessionControl?.setErrors(null);
      //console.log('all checked');
      //stateCtrl.setValue(true);
    } else {
      sessionControl?.setValue(false);
      sessionControl?.markAsTouched();
      sessionControl?.markAsDirty();
      sessionControl?.setErrors(null);
      //console.log('none checked');
      //stateCtrl.setValue(false);
    }
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

  async fetchBundleList(username) {
    return await this.systemService.sendCommandToBackend({
      cmd: "fetchBundleList",
      projectId: this.project.id,
      username: username,
    });
  }

  async fetchBundleLists() {
    for(let key in this.project.members) {
      let member = this.project.members[key];
      let data = await this.systemService.sendCommandToBackend({
        cmd: "fetchBundleList",
        projectId: this.project.id,
        username: member.username,
      });

      console.log(data);
    }
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
    let searchBox = document.getElementById("search-user-input");
    if(!this.addMemberDialogShown) {
      searchBox.style.display = "flex";
      searchBox.style.opacity = "1.0";
      searchBox.style.maxWidth = "100%";
      this.addMemberDialogShown = true;
      searchBox.focus();
    }
    else {
      searchBox.style.display = "none";
      searchBox.style.opacity = "0.0";
      searchBox.style.maxWidth = "0%";
      this.addMemberDialogShown = false;
    }
  }



  addMember(user) {
    //Add this user as a member to the project
    
    this.toggleMemberSearch();
    (<HTMLInputElement>document.getElementById("search-user-control")).value = "";
    this.searchUsers = [];
  }

  removeMember(user) {
    if(window.confirm('Really remove member '+user.item+' from the project?')) {
      let userGitlabId = null;
      this.projectMembers.forEach((member) => {
        if(member.username == user.id) {
          userGitlabId = member.id;
        }
      });
      if(userGitlabId == null) {
        console.error("Couldn't find user gitlab id when attempting to remove from project.");
        return;
      }
    }
  }

  searchUser(evt) {
    let searchValue = evt.target.value;
    if(searchValue == "") {
      document.getElementById("user-select-options").style.display = "none";
      return;
    }
  }

  validateForm() {
    console.log("validateForm");
    return true;
  }

  setSaveFormStatus(statusText:string) {
    this.submitBtnLabel = statusText;
  }

  getBundleListByUsername(bundleLists, username) {
    for(let key in bundleLists) {
      if(bundleLists[key].username == username) {
        return bundleLists[key];
      }
    }
    //If we end up here, there's no existing bundleList for this user, so we create one and return that
    let bundleList = {
      userId: username,
      username: username,
      bundles: []
    }
    bundleLists.push(bundleList)
    return bundleList;
  }

  async saveForm() {
    this.submitBtnEnabled = false;
    
    let bundleLists = [];

    this.form.value.members.forEach((member) => {
      member.username;
      let bundleList = [];

      member.sessions.forEach((session) => {
        session.bundles.forEach((bundle) => {
          if(bundle.selected) {
            let bundleName = bundle.name.replace(/\..+$/, '');
            bundleList.push({
              session: session.name,
              name: bundleName,
              fileName: bundle.name,
              comment: bundle.comment,
              finishedEditing: bundle.finishedEditing
            });
          }
        });
      });

      bundleLists.push({
        username: member.username,
        bundles: bundleList
      });

    });

    this.systemService.sendCommandToBackend({
      cmd: "saveBundleLists",
      projectId: this.project.id,
      bundleLists: bundleLists
    }).then((data:WebSocketMessage) => {
      this.notifierService.notify("info", "Bundle assignment lists saved");
      this.submitBtnEnabled = true;
    });
  }

  showComment(bundle) {
    console.log(bundle.value.comment);
  }

  //this method also exists in project-dialog.component.ts, which is perhaps a bit weird?
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
