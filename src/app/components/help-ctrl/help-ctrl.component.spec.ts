import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpCtrlComponent } from './help-ctrl.component';

describe('HelpCtrlComponent', () => {
  let component: HelpCtrlComponent;
  let fixture: ComponentFixture<HelpCtrlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HelpCtrlComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HelpCtrlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
