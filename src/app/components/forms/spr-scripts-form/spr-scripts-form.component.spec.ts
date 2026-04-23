import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SprScriptsFormComponent } from './spr-scripts-form.component';

describe('SprScriptsFormComponent', () => {
  let component: SprScriptsFormComponent;
  let fixture: ComponentFixture<SprScriptsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SprScriptsFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SprScriptsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
