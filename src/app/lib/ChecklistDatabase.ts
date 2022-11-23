import { Injectable } from '@angular/core';
import { FormGroup, FormArray, Form } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';

export class ItemNode {
    children: ItemNode[];
    item: string;
    id: string;
}
export class ItemFlatNode {
    item: string;
    id: string;
    level: number;
    expandable: boolean;
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
     // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
     //     file node as children.
     //const data = this.buildFileTree(treeData, 0);
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
      userNode.children = [];
      
      user.sessions.forEach(session => {
        let sessionNode = new ItemNode();
        sessionNode.item = session.sessionName;
        sessionNode.children = [];
        
        session.bundles.forEach(bundle => {
          let bundleNode = new ItemNode();
          bundleNode.item = bundle.bundleName;
          bundleNode.children = [];
          sessionNode.children.push(bundleNode);
        });

        userNode.children.push(sessionNode);
        
      });
      nodes.push(userNode);
    });

    return nodes;
  }
 
   /**
    * Build the file structure tree. The `value` is the Json object, or a sub-tree of a Json object.
    * The return value is the list of `TodoItemNode`.
    */
   buildFileTree(obj: {[key: string]: any}, level: number): ItemNode[] {
     return Object.keys(obj).reduce<ItemNode[]>((accumulator, key) => {
       const value = obj[key];
       const node = new ItemNode();
       node.item = key;
 
       if (value != null) {
         if (typeof value === 'object') {
           node.children = this.buildFileTree(value, level + 1);
         } else {
           node.item = value;
         }
       }
 
       return accumulator.concat(node);
     }, []);
   }
 
   /** Add an item to to-do list */
   insertItem(parent: ItemNode, name: string) {
     if (parent.children) {
       parent.children.push({item: name} as ItemNode);
       this.dataChange.next(this.data);
     }
   }
 
   updateItem(node: ItemNode, name: string) {
     node.item = name;
     this.dataChange.next(this.data);
   }
 }
 