import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppctrlComponent } from './appctrl.component';

describe('AppctrlComponent', () => {
  let component: AppctrlComponent;
  let fixture: ComponentFixture<AppctrlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AppctrlComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppctrlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
