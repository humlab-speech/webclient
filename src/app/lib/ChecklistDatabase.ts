import { Injectable } from '@angular/core';
import { FormGroup, FormArray, Form } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { nanoid } from "nanoid";

export class ItemNode {
    children: ItemNode[];
    item: string;
    id: string;
    type: string;
    avatar: string;
}
export class ItemFlatNode {
    item: string;
    id: string;
    level: number;
    expandable: boolean;
    type: string;
    avatar: string;
}

/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
 @Injectable()
 export class ChecklistDatabase {
   dataChange = new BehaviorSubject<ItemNode[]>([]);
 
   get data(): ItemNode[] {
     return this.dataChange.value;
   }
 
   constructor() {
   }
 
   initialize(treeData) {
     const data = this.buildTreeFromFormGroup(treeData);
 
     // Notify the change.
     this.dataChange.next(data);
   }

  buildTreeFromFormGroup(formGroup:FormGroup) {
    let nodes = [];
    let projectMembers:FormArray = <FormArray>formGroup.controls.projectMembers;

    projectMembers.value.forEach(user => {
      let userNode = new ItemNode();
      userNode.item = user.member.name;
      userNode.id = user.member.username;
      userNode.type = "user";
      userNode.avatar = user.member.avatar_url;
      userNode.children = [];
      
      user.sessions.forEach(session => {
        let sessionNode = new ItemNode();
        sessionNode.id = nanoid();
        sessionNode.item = session.sessionName;
        sessionNode.type = "session";
        sessionNode.children = [];
        
        session.bundles.forEach(bundle => {
          let bundleNode = new ItemNode();
          bundleNode.id = nanoid();
          bundleNode.item = bundle.bundleName;
          bundleNode.type = "bundle";
          bundleNode.children = [];
          sessionNode.children.push(bundleNode);
        });

        if(session.bundles.length > 0) { //only include this session if it actually has bundles, otherwise it will cause problems
          userNode.children.push(sessionNode);
        }
        
      });
      nodes.push(userNode);
    });

    return nodes;
  }
 
 
   /** Add an item to to-do list */
   insertItem(parent: ItemNode, name: string) {
    console.log("inserting item")
     if (parent.children) {
       parent.children.push({item: name} as ItemNode);
       this.dataChange.next(this.data);
     }
   }
 
   updateItem(node: ItemNode, name: string) {
    console.log("updating item")
     node.item = name;
     this.dataChange.next(this.data);
   }
 }
 