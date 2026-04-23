import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-script-app-dialog',
  templateUrl: './script-app-dialog.component.html',
  styleUrls: ['./script-app-dialog.component.scss']
})
export class ScriptAppDialogComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  closeDialog() {
    window.dispatchEvent(new Event('hide-script-dialog'));
  }

}
