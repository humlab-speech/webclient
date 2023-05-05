import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageSprScriptsDialogComponent } from './manage-spr-scripts-dialog.component';

describe('ManageSprScriptsDialogComponent', () => {
  let component: ManageSprScriptsDialogComponent;
  let fixture: ComponentFixture<ManageSprScriptsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageSprScriptsDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageSprScriptsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
