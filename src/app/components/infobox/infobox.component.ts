import { Component, OnInit, Input } from '@angular/core';
import { Infobox } from "../../models/Infobox";

@Component({
  selector: 'app-infobox',
  templateUrl: './infobox.component.html',
  styleUrls: ['./infobox.component.scss']
})
export class InfoboxComponent implements OnInit {
  
  @Input() infobox: Infobox;
  baseDomain:string = window.location.hostname;

  constructor() { }

  ngOnInit(): void {
  }
}
