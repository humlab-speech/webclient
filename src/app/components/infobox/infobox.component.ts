import { Component, OnInit, Input } from '@angular/core';
import { Infobox } from "../../models/Infobox";

@Component({
  selector: 'app-infobox',
  templateUrl: './infobox.component.html',
  styleUrls: ['./infobox.component.scss']
})
export class InfoboxComponent implements OnInit {
  
  @Input() infobox: Infobox;

  constructor() { }

  ngOnInit(): void {
  }

  redirectToOctra() {
    window.location.href = "https://octra."+window.location.hostname;
  }
}
