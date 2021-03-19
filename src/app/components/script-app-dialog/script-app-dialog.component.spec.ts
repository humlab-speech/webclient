import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScriptAppDialogComponent } from './script-app-dialog.component';

describe('ScriptAppDialogComponent', () => {
  let component: ScriptAppDialogComponent;
  let fixture: ComponentFixture<ScriptAppDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScriptAppDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScriptAppDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
