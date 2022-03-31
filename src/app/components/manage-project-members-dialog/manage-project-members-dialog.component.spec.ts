import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageProjectMembersDialogComponent } from './manage-project-members-dialog.component';

describe('ManageProjectMembersDialogComponent', () => {
  let component: ManageProjectMembersDialogComponent;
  let fixture: ComponentFixture<ManageProjectMembersDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageProjectMembersDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageProjectMembersDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
