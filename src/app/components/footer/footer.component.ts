import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  public umuLogoPath: string = "/assets/umu-logotyp-EN.svg";
  private readonly umuLogoPathEn: string = "/assets/umu-logotyp-EN.svg";
  private readonly umuLogoPathSe: string = "/assets/umu-logotyp-SE.svg";

  constructor() { }

  ngOnInit(): void {
    this.umuLogoPath = this.getUmuLogoPath();
  }

  private getUmuLogoPath(): string {
    const browserLanguage = (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en").toLowerCase();
    if (browserLanguage.startsWith("sv")) {
      return this.umuLogoPathSe;
    }
    return this.umuLogoPathEn;
  }
}
