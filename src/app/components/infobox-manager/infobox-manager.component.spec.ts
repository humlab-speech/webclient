import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoboxManagerComponent } from './infobox-manager.component';

describe('InfoboxManagerComponent', () => {
  let component: InfoboxManagerComponent;
  let fixture: ComponentFixture<InfoboxManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InfoboxManagerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InfoboxManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
