import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ProjectService } from 'src/app/services/project.service';
import { ModalService } from 'src/app/services/modal.service';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { Project } from "../../models/Project";
import { SystemService } from 'src/app/services/system.service';	
import { WebSocketMessage } from 'src/app/models/WebSocketMessage';
import { NotifierService } from 'angular-notifier';

@Component({
  selector: 'app-transcribe-dialog',
  templateUrl: './transcribe-dialog.component.html',
  styleUrls: ['./transcribe-dialog.component.scss'],
})
export class TranscribeDialogComponent implements OnInit {

  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  transcriptionForm: FormGroup;
  showLoadingIndicator: boolean = false;

  // Languages available
  availableLanguages = ['Automatic Detection', 'afrikaans', 'albanian', 'amharic', 'arabic', 'armenian', 'assamese', 'azerbaijani', 'bashkir', 'basque', 'belarusian', 'bengali', 'bosnian', 'breton', 'bulgarian', 'cantonese', 'catalan', 'chinese', 'croatian', 'czech', 'danish', 'dutch', 'english', 'estonian', 'faroese', 'finnish', 'french', 'galician', 'georgian', 'german', 'greek', 'gujarati', 'haitian creole', 'hausa', 'hawaiian', 'hebrew', 'hindi', 'hungarian', 'icelandic', 'indonesian', 'italian', 'japanese', 'javanese', 'kannada', 'kazakh', 'khmer', 'korean', 'lao', 'latin', 'latvian', 'lingala', 'lithuanian', 'luxembourgish', 'macedonian', 'malagasy', 'malay', 'malayalam', 'maltese', 'maori', 'marathi', 'mongolian', 'myanmar', 'nepali', 'norwegian', 'nynorsk', 'occitan', 'pashto', 'persian', 'polish', 'portuguese', 'punjabi', 'romanian', 'russian', 'sanskrit', 'serbian', 'shona', 'sindhi', 'sinhala', 'slovak', 'slovenian', 'somali', 'spanish', 'sundanese', 'swahili', 'swedish', 'tagalog', 'tajik', 'tamil', 'tatar', 'telugu', 'thai', 'tibetan', 'turkish', 'turkmen', 'ukrainian', 'urdu', 'uzbek', 'vietnamese', 'welsh', 'yiddish', 'yoruba'];
  languages = [];

  models = [{
    id: 'whisper',
    name: 'Whisper',
  }, {
    id: 'kb-whisper',
    name: 'KB Whisper',
  }];

  private intervalId: any;
  public transcriptionQueueItemsLoaded: boolean = false;

  constructor(private fb: FormBuilder, private modalService: ModalService, private projectService: ProjectService, private systemService: SystemService, private notifierService: NotifierService) {
    
    //make this.languages into an array of objects with id and name based on the availableLanguages
    //the first letter of the language name should be capitalized
    //if the language is 'Automatic Detection', the name should be 'Auto'
    this.availableLanguages.forEach((language) => {
      let capitalizedLanguage = language.charAt(0).toUpperCase() + language.slice(1);
      let name = language == 'Automatic Detection' ? 'Auto' : capitalizedLanguage;
      this.languages.push({ id: capitalizedLanguage, name: name } );
    });
    
    this.transcriptionForm = this.fb.group({
      bundles: this.fb.array([]), // Initialize as a FormArray for all bundles
    });
  }

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;
    this.loadBundles();

    this.fetchTranscriptionQueueItems();
    this.intervalId = setInterval(() => {
      this.fetchTranscriptionQueueItems();
    }, 5000);
  }

  ngOnDestroy(): void {
    this.clearRefreshInterval();
  }

  // Getter for bundles FormArray
  get bundles(): FormArray {
    return this.transcriptionForm.get('bundles') as FormArray;
  }

  async fetchTranscriptionQueueItems(): Promise<void> {
    this.systemService.sendCommandToBackend({
      cmd: "fetchTranscriptionQueueItems",
      data: {
        project: this.project.id,
      }
    }).then((msg:WebSocketMessage) => {
      //console.log('Transcription queue items fetched:', msg);

      if(msg.cmd == "fetchTranscriptionQueueItems" && msg.progress == "end") {
        if(msg.result == false) {
          console.error('Failed to fetch transcription queue items:', msg);
          this.notifierService.notify('error', msg.message);
          this.transcriptionQueueItemsLoaded = true;
          return;
        }
        const queueItems = msg.data;

        // Update the form with the queue items status
        queueItems.forEach((queueItem) => {
          //we need to find the right bundle based on the session and bundle name
          const bundle = this.bundles.controls.find((bundle) => {
            return queueItem.project == this.project.id && bundle.value.sessionName == queueItem.session && bundle.value.name == queueItem.bundle;
          });
          if(bundle) {
            let capitalizedStatus = queueItem.status.charAt(0).toUpperCase() + queueItem.status.slice(1);
            bundle.patchValue({ status: capitalizedStatus });

            const languageControl = bundle.get('language');
            if (languageControl && !languageControl.touched) {
              languageControl.patchValue(queueItem.language);
            }
          }
        });

        this.transcriptionQueueItemsLoaded = true;
      }

    });
  }

  // Load bundles from the project and sessions into the FormArray
  loadBundles(): void {
    this.project.sessions.forEach((session) => {
      session.files.forEach((file) => {
        console.log('Adding bundle:', file);
        this.bundles.push(
          this.fb.group({
            sessionName: [session.name], // Add session name for display
            id: [file.id],
            name: [file.name, Validators.required],
            language: [session.language || 'Automatic Detection', Validators.required], // Default to session language or auto
            model: ['whisper', Validators.required], // Default model
            status: "",
            oldStatus: "",
            selectedFileType: ['srt'],
          })
        );
      });
    });
  }

  // Handle language selection for a specific bundle
  onLanguageSelected(bundleIndex: number, event: Event): void {
    const selectedLanguage = (event.target as HTMLSelectElement).value;
    const bundle = this.bundles.at(bundleIndex) as FormGroup;
    bundle.patchValue({ language: selectedLanguage });
    console.log(`Language updated for bundle ${bundle.value.name}: ${selectedLanguage}`);
  }

  onModelSelected(bundleIndex: number, event: Event): void {
    const selected = (event.target as HTMLSelectElement).value;
    const bundle = this.bundles.at(bundleIndex) as FormGroup;
    bundle.patchValue({ model: selected });
    console.log(`Model updated for bundle ${bundle.value.name}: ${selected}`);
  }

  // Add a bundle to the transcription queue
  addToTranscriptionQueue(bundle: any): void {
    console.log('Adding bundle to transcription queue:', bundle);

    this.systemService.sendCommandToBackend({
      cmd: "transcribe",
      data: {
        project: this.project.id,
        session: bundle.value.sessionName,
        bundle: bundle.value.name,
        language: bundle.value.language,
        model: bundle.value.model,
      }
    }).then((msg:WebSocketMessage) => {
      if(!msg.result) {
        console.error('Transcription request failed:', msg);
        this.notifierService.notify('info', "Unknown error.");
      }

      this.showLoadingIndicator = true;
    });

    bundle.patchValue({ oldStatus: bundle.value.status });
    bundle.patchValue({ status: 'Queued' });

    //this.notifierService.notify('info', "Transcription request sent. You will be notified when all your transcriptions are complete.");
  }

  removeTranscriptionFromQueue(bundle: any): void {
    console.log('Removing transcription from queue:', bundle);

    this.systemService.sendCommandToBackend({
      cmd: "removeTranscriptionFromQueue",
      data: {
        project: this.project.id,
        session: bundle.value.sessionName,
        bundle: bundle.value.name,
      }
    }).then((msg:WebSocketMessage) => {
      if(!msg.result) {
        console.error('Transcription removal failed:', msg);
        this.notifierService.notify('info', "Unknown error.");
      }
    });

    bundle.patchValue({ status: bundle.value.oldStatus });
  }

  showTranscription(bundle: any): void {
    console.log(bundle);
  }

  downloadTranscription(bundle: any): void {
    console.log('Downloading transcription:', bundle);

    this.systemService.sendCommandToBackend({
      cmd: "fetchTranscription",
      data: {
        project: this.project.id,
        session: bundle.value.sessionName,
        bundle: bundle.value.name,
      }
    }).then((msg:WebSocketMessage) => {

        let data = null;
        let extension = null;
        if(bundle.value.selectedFileType == "srt") {
          data = msg.data.srt;
          extension = "srt";
        }
        else if(bundle.value.selectedFileType == "txt") {
          data = msg.data.text;
          extension = "txt";
        }

        const blob = new Blob([data], { type: 'text/plain' });
        // Step 2: Create a temporary anchor element (<a>)
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "transcription."+extension; // Set the file name

        // Step 3: Programmatically click the link to trigger download
        link.click();

        // Step 4: Cleanup by revoking the object URL
        URL.revokeObjectURL(link.href);
    });
  }

  clearRefreshInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Close the dialog
  closeDialog(): void {
    console.log('Dialog closed');
    this.modalService.hideModal('transcribe-dialog');
    this.clearRefreshInterval();
  }
}
