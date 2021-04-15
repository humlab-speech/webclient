import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';

@Component({
  selector: 'app-import-audio-form',
  templateUrl: './import-audio-form.component.html',
  styleUrls: ['./import-audio-form.component.scss']
})
export class ImportAudioFormComponent implements OnInit {

  @Input() projectManager;

  form:FormGroup;

  constructor(private fb:FormBuilder) { }

  ngOnInit(): void {
    this.form = this.fb.group({});
  }

  importAudio() {
    console.log("totally importing audio!");

    console.log(this.form);
  }

  closeCreateProjectDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

}
