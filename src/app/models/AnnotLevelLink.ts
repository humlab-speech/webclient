import { AnnotLevel } from "./AnnotLevel";

export class AnnotLevelLink {
    superLevel?:AnnotLevel;
    subLevel?:AnnotLevel;
    type?:string;
    editMode:boolean = true;
}