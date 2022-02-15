import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
    switch(window.location.pathname) {
      case "/about": //show english version
        document.getElementById("about-text-swedish").style.display = 'none';
        document.getElementById("about-text-english").style.display = 'block';
        break;
      case "/om": //show swedish version
        document.getElementById("about-text-swedish").style.display = 'block';
        document.getElementById("about-text-english").style.display = 'none';
        break; 
    }

  }

}
