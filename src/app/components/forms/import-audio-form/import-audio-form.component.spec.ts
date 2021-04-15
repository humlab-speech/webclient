import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportAudioFormComponent } from './import-audio-form.component';

describe('ImportAudioFormComponent', () => {
  let component: ImportAudioFormComponent;
  let fixture: ComponentFixture<ImportAudioFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImportAudioFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportAudioFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
