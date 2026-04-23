import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageProjectMembersFormComponent } from './manage-project-members-form.component';

describe('ManageProjectMembersFormComponent', () => {
  let component: ManageProjectMembersFormComponent;
  let fixture: ComponentFixture<ManageProjectMembersFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageProjectMembersFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageProjectMembersFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
