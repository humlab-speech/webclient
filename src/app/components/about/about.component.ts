import { Component, OnInit } from '@angular/core';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(private themeService: ThemeService) { }

  logoPath(language: 'sv' | 'en'): string {
    const variant = this.themeService.theme === 'dark' ? '_dark' : '';
    return `assets/visp_slogan_${language}${variant}.svg`;
  }

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
