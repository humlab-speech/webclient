import { Component } from '@angular/core';
import { brandLanguage } from 'src/app/lib/locale';

interface FooterLink {
  label: string;
  href: string;
}

// Page footer laid out per Språkbanken's graphic profile: Språkbanken and its
// links on the left and a call to get in touch in the middle. The logo of the
// node hosting this installation (Umeå University) is in the topbar.
const FOOTER_TEXT = {
  sv: {
    sprakbanken: 'https://sprakbanken.se/',
    about: { label: 'Om oss', href: 'https://sprakbanken.se/om' },
    news: { label: 'Nyheter från Språkbanken', href: 'https://sprakbanken.se/aktuellt' },
    platforms: { label: 'Andra plattformar', href: 'https://sprakbanken.se/plattformar' },
    callout: 'Använder du våra plattformar, datamängder eller analyser i ditt arbete? Då vill vi gärna höra från dig!',
    contact: { label: 'Kontakta oss', href: 'https://sprakbanken.se/kontakt' },
    cite: { label: 'Referera till oss', href: 'https://sprakbanken.se/om/referera-till-oss' },
  },
  en: {
    sprakbanken: 'https://sprakbanken.se/en',
    about: { label: 'About us', href: 'https://sprakbanken.se/en/about' },
    news: { label: 'News from Språkbanken', href: 'https://sprakbanken.se/en/news-and-events' },
    platforms: { label: 'Other platforms', href: 'https://sprakbanken.se/en/platforms' },
    callout: 'Do you use our platforms, datasets or analyses in your work? We would love to hear from you!',
    contact: { label: 'Contact us', href: 'https://sprakbanken.se/en/contact' },
    cite: { label: 'How to cite us', href: 'https://sprakbanken.se/en/about/how-to-cite' },
  },
};

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  public readonly text = FOOTER_TEXT[brandLanguage()];
  public readonly sprakbankenLinks: FooterLink[] = [this.text.about, this.text.news, this.text.platforms];
  public readonly contactLinks: FooterLink[] = [this.text.contact, this.text.cite];
}
