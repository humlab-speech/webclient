import { Component, OnInit, Input, Injectable } from '@angular/core';
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
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { SelectionModel } from '@angular/cdk/collections';
import { NotifierService } from 'angular-notifier';
import { ItemNode, ItemFlatNode, ChecklistDatabase } from '../../../lib/ChecklistDatabase';

@Component({
  selector: 'app-manage-project-members-form',
  templateUrl: './manage-project-members-form.component.html',
  styleUrls: ['./manage-project-members-form.component.scss'],
  providers: [ChecklistDatabase],
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


  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap = new Map<ItemFlatNode, ItemNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap = new Map<ItemNode, ItemFlatNode>();

  /** A selected parent node to be inserted */
  selectedParent: ItemFlatNode | null = null;

  /** The new item's name */
  newItemName = '';

  treeControl: FlatTreeControl<ItemFlatNode>;

  treeFlattener: MatTreeFlattener<ItemNode, ItemFlatNode>;

  dataSource: MatTreeFlatDataSource<ItemNode, ItemFlatNode>;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<ItemFlatNode>(true /* multiple */);

  treeDatabase:ChecklistDatabase;

  notifierService:NotifierService;


  constructor(private fb:FormBuilder, private projectService:ProjectService, private userService:UserService, private _database: ChecklistDatabase, notifierService: NotifierService) {
    
    this.treeDatabase = _database;
    this.notifierService = notifierService;

    /*
    this.checklistSelection.changed.subscribe((selection) => {
      selection.added.forEach((node:ItemFlatNode) => {
        let asignees = this.getNumberOfBundleAssignees(node);
        if(this.checklistSelection.isSelected(node) && node.expandable == false) {
          //Check if this bundle is selected for any other user
          if(asignees > 1) {
            this.notifierService.notify("info", "The bundle "+node.item+" is already assigned to one or more other users.");
          }
        }
      });
    });
    */

    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren,
    );
    this.treeControl = new FlatTreeControl<ItemFlatNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

    this.treeDatabase.dataChange.subscribe(data => {
      this.dataSource.data = data;
    });
  }

  getLevel = (node: ItemFlatNode) => node.level;

  isExpandable = (node: ItemFlatNode) => node.expandable;

  getChildren = (node: ItemNode): ItemNode[] => node.children;

  hasChild = (_: number, _nodeData: ItemFlatNode) => _nodeData.expandable;

  hasNoContent = (_: number, _nodeData: ItemFlatNode) => _nodeData.item === '';

  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  transformer = (node: ItemNode, level: number) => {
    const existingNode = this.nestedNodeMap.get(node);
    const flatNode =
      existingNode && existingNode.item === node.item ? existingNode : new ItemFlatNode();
    flatNode.item = node.item;
    flatNode.id = node.id;
    flatNode.level = level;
    flatNode.expandable = !!node.children?.length;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  };

  /** Whether all the descendants of the node are selected. */
  descendantsAllSelected(node: ItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every(child => {
        return this.checklistSelection.isSelected(child);
      });
    return descAllSelected;
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: ItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child => this.checklistSelection.isSelected(child));
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle the to-do item selection. Select/deselect all the descendants node */
  todoItemSelectionToggle(node: ItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);

    // Force update for the parent
    descendants.forEach(child => this.checklistSelection.isSelected(child));
    this.checkAllParentsSelection(node);
  }

  getNumberOfBundleAssigneesInSession(sessionFlatNode:ItemFlatNode) {
    let sessionNode = this.getItemNodeByItemFlatNode(sessionFlatNode);
    
    let assignees = 0;
    sessionNode.children.forEach(bundleNode => {
      this.checklistSelection.selected.forEach(node => {
        if(node.item == bundleNode.item) {
          assignees++;
        }
      });
    });
    return assignees;
  }

  getNumberOfBundleAssignees(bundle:ItemFlatNode) {
    let assignees = 0;
    this.checklistSelection.selected.forEach(node => {
      if(node.item == bundle.item) {
        assignees++;
      }
    });
    return assignees;
  }

  /** Toggle a leaf to-do item selection. Check all the parents to see if they changed */
  todoLeafItemSelectionToggle(node: ItemFlatNode): void {
    this.checklistSelection.toggle(node);
    this.checkAllParentsSelection(node);
  }

  /* Checks all the parents when a leaf node is selected/unselected */
  checkAllParentsSelection(node: ItemFlatNode): void {
    let parent: ItemFlatNode | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }

  /** Check root node checked state and change it accordingly */
  checkRootNodeSelection(node: ItemFlatNode): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every(child => {
        return this.checklistSelection.isSelected(child);
      });
    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }

  /* Get the parent node of a node */
  getParentNode(node: ItemFlatNode): ItemFlatNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  /** Select the category so we can insert the new item. */
  addNewItem(node: ItemFlatNode) {
    const parentNode = this.flatNodeMap.get(node);
    this._database.insertItem(parentNode!, '');
    this.treeControl.expand(node);
  }

  /** Save the node to database */
  saveNode(node: ItemFlatNode, itemValue: string) {
    const nestedNode = this.flatNodeMap.get(node);
    this._database.updateItem(nestedNode!, itemValue);
  }









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
    this.loadData().then((projectMembers:any) => {
      this.setLoadingStatus(false);
    });
  }

  getBundleListByItemFlatNode(bundleNode:ItemFlatNode) {
    let sessNode = this.getParentNode(bundleNode);
    let userNode = this.getParentNode(sessNode);
    
    for(let key in this.projectMembers) {
      let user = this.projectMembers[key];
      if(user.username == userNode.id) {
        return user.bundleList;
      } 
    }

    return null;
  }

  getItemNodeByItemFlatNode(searchNode) {
    let foundNode = null;
    this.flatNodeMap.forEach((node, flatNode) => {
      if(flatNode == searchNode) {
        foundNode = node;
      }
    });
    return foundNode;
  }

  finishedEditing(bundleNode:ItemFlatNode) {
    let bl = this.getBundleListByItemFlatNode(bundleNode);
    for(let key in bl) {
      let b = bl[key];
      if(b.name == bundleNode.item) {
        return b.finishedEditing;
      }
    }
    return false;
  }

  applyUserBundleLists(projectMembers) {
    console.log("Applying bundle lists");
    this.checklistSelection.clear();
    this.treeDatabase.data.forEach((userNode:ItemNode) => {
      userNode.children.forEach((sessionNode:ItemNode) => {
        sessionNode.children.forEach((bundleNode:ItemNode) => {
          
          for(let key in projectMembers) {
            let user = projectMembers[key];
            if(typeof user.bundleList != "undefined") {
              user.bundleList.forEach(bundle => {

                if(user.username == userNode.id && bundle.name == bundleNode.item) {

                  let bundleFlatNode = null;
                  this.flatNodeMap.forEach((node, flatNode) => {
                    if(node == bundleNode) {
                      bundleFlatNode = flatNode;
                    }
                  });

                  this.todoLeafItemSelectionToggle(bundleFlatNode);
                }
              });
            }
            else {
              console.log("user has no bundlelist - skippping assignment")
            }
          }
        })

      });
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

  userIsProjectOwner(userNode) {
    for(let key in this.projectMembers) {
      let owner = <any>this.project.owner;
      if(this.projectMembers[key].username == userNode.id && this.projectMembers[key].id == owner.id) {
        return true;
      }
    }
    return false;
  }

  onChange(value) {
  }
  onTouched() {
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
    let projectSessions = await new Promise<any>((resolve, reject) => {
      this.projectService.fetchProjectSessions(this.project.id).subscribe(sessions => {
        resolve(sessions);
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

    return await new Promise<void>((resolve, reject) => {
      this.projectMemberForms.clear();
      this.projectService.fetchProjectMembers(this.project.id).subscribe(async members => {
        members.forEach(member => {
          let memberFormGroup = new FormGroup({
            "member": new FormControl(member),
            "sessions": projectSessionsFormArray
          });

          this.projectMemberForms.push(memberFormGroup);
          
        });        
        
        this.projectMembers = members;
        //Try to get the bundleList of each project member

        let bundleListsFetched = 0;
        await new Promise<void>((resolve, reject) => {
          this.projectMembers.forEach(member => {
            member.bundles = [];
            this.projectService.fetchBundleList(this.project, member.username).subscribe(bundleListResponse => {
              let bundleList = JSON.parse(atob(bundleListResponse.content));
              member.bundleList = bundleList;
              member.createBundleList = false;
              bundleListsFetched++;
              if(bundleListsFetched == this.projectMembers.length) {
                resolve();
              }
            }, err => {
              if(err.status == 404) {
                //Bund list not found for this member, which is fine
                console.log("No bundlelist found for "+member.username);
                member.bundleList = [];
                member.createBundleList = true;
                bundleListsFetched++;
                if(bundleListsFetched == this.projectMembers.length) {
                  resolve();
                }
              }
            });
          });

        });

        this.treeDatabase.initialize(this.form);
        this.applyUserBundleLists(this.projectMembers);
        
        resolve(this.projectMembers);
        
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
      this.projectService.removeProjectMember(this.project.id, userGitlabId).subscribe(() => {
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

  getBundleListsFromFlatTreeControl(treeControl) {
    let bundleLists = [];
    treeControl.dataNodes.forEach((node:ItemFlatNode) => {
      if(node.level == 2 && this.checklistSelection.isSelected(node)) {
        let sessionNode = this.getParentNode(node);
        let userNode = this.getParentNode(sessionNode);

        let bundleList = this.getBundleListByUsername(bundleLists, userNode.id);

        let bundle = new BundleListItem();
        bundle.session = sessionNode.item;
        bundle.name = node.item;
        bundle.finishedEditing = false;

        this.projectMembers.forEach((member) => {
          if(member.username == userNode.id) {
            for(let key in member.bundleList) {
              if(member.bundleList[key].session == sessionNode.item && member.bundleList[key].name == node.item) {
                console.log("finishedEditing state transfer", member.bundleList[key].finishedEditing);
                bundle.finishedEditing = member.bundleList[key].finishedEditing;
              }
            }
          }
        });

        bundleList.bundles.push(bundle);
      }
    });

    
    //This is just for inserting any user's that have no bundles selected - so that they get empty bundlelists
    treeControl.dataNodes.forEach((node:ItemFlatNode) => {
      if(node.level == 0) { //user level
        let userBundleListFound = false;
        for(let key in bundleLists) {
          if(bundleLists[key].username == node.item) {
            userBundleListFound = true;
          }
        }
        if(!userBundleListFound) {
          this.getBundleListByUsername(bundleLists, node.id); //this function will automatically insert a new bundlelist when trying to fetch a non-existant one
        }
      }
    });

    return bundleLists;
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
    let bundleLists = this.getBundleListsFromFlatTreeControl(this.treeControl);

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

    
    this.projectService.updateBundleLists(this.sessionAccessCode, bundleLists).subscribe(msg => {
      let msgData = JSON.parse(msg.data);
      if(msgData.type == "cmd-result" && msgData.cmd == "updateBundleLists") {
        /* this should probably be implemented at some point - but should be done properly as a generic system
        if(msgData.progress.indexOf("/")) {
          //this is the first of a series of status updates
          let parts = msgData.progress.split("/");
          let step = parts[0];
          let totalSteps = parts[1];
          console.log(step, totalSteps);
        }
        */
        this.setTaskProgress(1, 1, "member-form-save-button", "Done!");
        this.setLoadingStatus(false);
      }
      
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
