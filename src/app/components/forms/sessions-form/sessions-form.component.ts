
import { Component, OnInit, Input, forwardRef, OnDestroy } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
  FormArray,
  NG_VALIDATORS,
  ValidationErrors,
  AbstractControl,
  ValidatorFn
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { NotifierService } from 'angular-notifier';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from '../../../models/Project';
import { ProjectManagerComponent } from '../../project-manager/project-manager.component';
import { HttpClient } from '@angular/common/http'
import { FileUploadService } from "../../../services/file-upload.service";
import { UserService } from 'src/app/services/user.service';
import { nanoid } from 'nanoid';
import { Clipboard } from '@angular/cdk/clipboard';
import * as L from 'leaflet';

export interface EmudbFormValues {
  sessions: [];
  annotLevels: [];
  annotLevelLinks: [];
}

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

@Component({
  selector: 'app-sessions-form',
  templateUrl: './sessions-form.component.html', //used to be emudb-form.component.html
  styleUrls: ['./sessions-form.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SessionsFormComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SessionsFormComponent),
      multi: true
    }
  ]
})

export class SessionsFormComponent implements ControlValueAccessor, OnDestroy {
  @Input() formContextId: string;
  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project|null;
  @Input() parentForm:any;

  form:FormGroup;
  subscriptions: Subscription[] = [];
  sessions:FormArray;
  sessionScriptOptions:any = [];
  annotLevels:FormArray;
  annotLevelLinks:FormArray;
  annotLevelTypes = [
    'ITEM',
    'SEGMENT',
    'EVENT'
  ];
  
  annotLevelLinkTypes = [
    'ONE_TO_MANY',
    'ONE_TO_ONE',
    'MANY_TO_MANY'
  ];

  showSessions:boolean = true;
  showAnnotLevels:boolean = true;
  showAnnotLevelLinks:boolean = true;
  storedEmuDb:any = null; //The EmuDB as it exists in Gitlab (if any)
  sessionAccessCode:string = null;
  formIsValid:boolean = true;
  emuDbLoadingStatus:boolean = true;
  supportReOpeningSealedSprSession:boolean = false;
  isAddingSession:boolean = false;
  locationSearchQueryBySessionId: Record<string, string> = {};
  locationSearchResultsBySessionId: Record<string, NominatimSearchResult[]> = {};
  locationSearchInProgressBySessionId: Record<string, boolean> = {};
  sessionMapBySessionId: Map<string, L.Map> = new Map();
  sessionMarkerBySessionId: Map<string, L.CircleMarker> = new Map();
  readonly defaultMapCenter:[number, number] = [59.3293, 18.0686];
  readonly defaultMapZoom:number = 3;

  get value(): EmudbFormValues {
    return this.form.value;
  }

  set value(value: EmudbFormValues) {
    this.form.setValue(value);
    this.onChange(value);
    this.onTouched();
  }

  constructor(
    private fb:FormBuilder, 
    private notifierService: NotifierService, 
    private projectService: ProjectService, 
    private fileUploadService: FileUploadService,
    private userService: UserService,
    private http: HttpClient,
    private clipboard: Clipboard,
    ) {
  }
  
  ngOnInit(): void {
    this.form = this.fb.group({});

    this.sessions = this.fb.array([], this.validateSessionNameUnique);
    this.annotLevels = this.fb.array([], this.validateAnnotLevelNameUnique);
    this.annotLevelLinks = this.fb.array([], this.validateAnnotLevelLinkNotToSame);

    this.form.addControl("formContextId", new FormControl(this.formContextId));
    this.form.addControl("project", new FormControl(this.project));
    this.form.addControl("sessions", this.sessions);
    this.form.addControl("annotLevels", this.annotLevels);
    this.form.addControl("annotLevelLinks", this.annotLevelLinks);

    this.form.statusChanges.subscribe((status) => {
      this.validateForm();
    });

    this.subscriptions.push(
      // any time the inner form changes update the parent of any change
      this.form.valueChanges.subscribe(value => {
        this.onChange(value);
        this.onTouched();
      })
    );
    
    if(this.sessionForms.length == 0 && !this.project) {
      this.addSession();
    }
    
    if(this.project) {
      this.addSessions(this.project);
      this.addAnnotLevels(this.project);
      this.addAnnotLevelLinks(this.project);
    }
    else {
      this.emuDbLoadingStatus = false;
      //if no project is provided, we'll add some default annotLevels and annotLevelLinks
      this.addAnnotLevel("Word", "ITEM");
      this.addAnnotLevel("Phonetic", "SEGMENT");
      this.addAnnotLevelLink("Word", "Phonetic");
    }
  }

  async addSessions(project) {
    for(let key in project.sessions) {
      let session = project.sessions[key];
      await this.addSession(session);
    }
    this.emuDbLoadingStatus = false;
  }

  addAnnotLevels(project) {
    project.annotationLevels.forEach(annotLevel => {
      this.addAnnotLevel(annotLevel.name, annotLevel.type);
    });
  }

  addAnnotLevelLinks(project) {
    project.annotationLinks.forEach(annotLevelLink => {
      this.addAnnotLevelLink(annotLevelLink.superLevel, annotLevelLink.subLevel, annotLevelLink.type);
    });
  }

  adjustSessionNamesToAvoidConflict(externalSessions) {
    for(let key in this.sessions.value) {
      externalSessions.forEach(exSess => {
        if(exSess.name == this.sessions.value[key].name) {
          console.log('session name conflict');
        }
      });
    }
    
  }

  getFormGroup() {
    return this.form;
  }
  

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.sessionMapBySessionId.forEach(mapInstance => mapInstance.remove());
    this.sessionMapBySessionId.clear();
    this.sessionMarkerBySessionId.clear();
  }

  isFormValid() {
    return this.form.status != "INVALID" && this.fileUploadService.hasPendingUploads == false;
  }

  onChange: any = () => {};
  onTouched: any = () => {};

  registerOnChange(fn) {
    this.onChange = fn;
  }

  writeValue(value) {
    if (value) {
      this.value = value;
    }

    if (value === null) {
      //this.form.reset(); //I honestly don't know why angular is writing null when the form is initialized, but it does, and it's a nuisance, and disabling the reset doens't seem to hurt
    }
  }

  registerOnTouched(fn) {
    this.onTouched = fn;
  }

  // communicate the inner form validation to the parent form
  validate(_: FormControl) {
    return this.form.valid ? null : { profile: { valid: false } };
  }

  validateForm() {
    this.formIsValid = this.form.valid;
  }

  formatDateTimeForInput(value:any):string|null {
    if(!value) {
      return null;
    }
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) {
      return null;
    }
    const pad = (num:number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  formatCoordinates(lat:number, lon:number):string {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }

  parseCoordinates(value:any):{ lat:number, lon:number }|null {
    if(value === null || typeof value === "undefined") {
      return null;
    }
    const match = String(value).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/);
    if(!match) {
      return null;
    }
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    if(lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }
    return { lat, lon };
  }

  validateCoordinatesIfProvided(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if(value === null || typeof value === "undefined" || String(value).trim() === "") {
      return null;
    }
    return this.parseCoordinates(value) ? null : { invalidCoordinates: true };
  }

  getLocationMapElementId(sessionId:string):string {
    return `session-location-map-${sessionId}`;
  }

  getLocationQuery(sessionId:string):string {
    return this.locationSearchQueryBySessionId[sessionId] || "";
  }

  setLocationQuery(sessionId:string, value:string) {
    this.locationSearchQueryBySessionId[sessionId] = value;
  }

  getLocationSearchResults(sessionId:string):NominatimSearchResult[] {
    return this.locationSearchResultsBySessionId[sessionId] || [];
  }

  clearLocationSearchResults(sessionId:string) {
    this.locationSearchResultsBySessionId[sessionId] = [];
  }

  isLocationSearchInProgress(sessionId:string):boolean {
    return this.locationSearchInProgressBySessionId[sessionId] === true;
  }

  hasLocationSearchResults(sessionId:string):boolean {
    return this.getLocationSearchResults(sessionId).length > 0;
  }

  async searchLocation(session: FormGroup) {
    const sessionId = String(session.controls.id.value);
    const query = this.getLocationQuery(sessionId).trim();
    if(!query) {
      this.clearLocationSearchResults(sessionId);
      return;
    }
    this.locationSearchInProgressBySessionId[sessionId] = true;
    this.clearLocationSearchResults(sessionId);

    this.http.get<NominatimSearchResult[]>("https://nominatim.openstreetmap.org/search", {
      params: {
        q: query,
        format: "json",
        limit: "5",
      },
      headers: {
        "Accept-Language": "en"
      }
    }).subscribe({
      next: (results) => {
        this.locationSearchResultsBySessionId[sessionId] = Array.isArray(results) ? results : [];
      },
      error: () => {
        this.notifierService.notify("warning", "Location search failed. Try another query or enter coordinates manually.");
        this.locationSearchResultsBySessionId[sessionId] = [];
        this.locationSearchInProgressBySessionId[sessionId] = false;
      },
      complete: () => {
        this.locationSearchInProgressBySessionId[sessionId] = false;
      }
    });
  }

  selectLocationSearchResult(session: FormGroup, result: NominatimSearchResult) {
    const sessionId = String(session.controls.id.value);
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) {
      this.notifierService.notify("warning", "The selected location did not contain valid coordinates.");
      return;
    }
    const coordString = this.formatCoordinates(lat, lon);
    session.controls.placeOfRecording.setValue(coordString);
    session.controls.placeOfRecording.markAsDirty();
    this.setLocationQuery(sessionId, result.display_name || coordString);
    this.clearLocationSearchResults(sessionId);
    this.updateSessionMapMarker(sessionId, lat, lon, true);
  }

  onLocationInputChange(session: FormGroup, value: string) {
    const sessionId = String(session.controls.id.value);
    this.setLocationQuery(sessionId, value);
    this.clearLocationSearchResults(sessionId);
    const parsed = this.parseCoordinates(value);
    if(parsed) {
      const coordString = this.formatCoordinates(parsed.lat, parsed.lon);
      session.controls.placeOfRecording.setValue(coordString);
      session.controls.placeOfRecording.markAsDirty();
      this.updateSessionMapMarker(sessionId, parsed.lat, parsed.lon, true);
    } else if(value.trim() === '') {
      session.controls.placeOfRecording.setValue('');
      session.controls.placeOfRecording.markAsDirty();
    }
  }

  onAdvancedDetailsToggle(session: FormGroup, event: Event) {
    const details = event.target as HTMLDetailsElement;
    if(details.open) {
      setTimeout(() => this.ensureSessionMap(session), 0);
    }
  }

  ensureSessionMap(session: FormGroup) {
    const sessionId = String(session.controls.id.value);
    const mapElementId = this.getLocationMapElementId(sessionId);
    const mapElement = document.getElementById(mapElementId);
    if(!mapElement) {
      return;
    }

    let mapInstance = this.sessionMapBySessionId.get(sessionId);
    if(!mapInstance) {
      mapInstance = L.map(mapElementId).setView(this.defaultMapCenter, this.defaultMapZoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapInstance);

      mapInstance.on("click", (event:L.LeafletMouseEvent) => {
        const coordinates = this.formatCoordinates(event.latlng.lat, event.latlng.lng);
        session.controls.placeOfRecording.setValue(coordinates);
        session.controls.placeOfRecording.markAsDirty();
        this.setLocationQuery(sessionId, coordinates);
        this.clearLocationSearchResults(sessionId);
        this.updateSessionMapMarker(
          sessionId,
          event.latlng.lat,
          event.latlng.lng,
          false,
        );
      });

      this.sessionMapBySessionId.set(sessionId, mapInstance);
    } else {
      mapInstance.invalidateSize();
    }

    const parsedCoords = this.parseCoordinates(
      session.controls.placeOfRecording.value,
    );
    if(parsedCoords) {
      this.updateSessionMapMarker(sessionId, parsedCoords.lat, parsedCoords.lon, true);
    }
  }

  updateSessionMapMarker(sessionId:string, lat:number, lon:number, panToMarker = true) {
    const mapInstance = this.sessionMapBySessionId.get(sessionId);
    if(!mapInstance) {
      return;
    }

    let marker = this.sessionMarkerBySessionId.get(sessionId);
    if(!marker) {
      marker = L.circleMarker([lat, lon], {
        radius: 7,
        color: "#c0392b",
        fillColor: "#e74c3c",
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(mapInstance);
      this.sessionMarkerBySessionId.set(sessionId, marker);
    } else {
      marker.setLatLng([lat, lon]);
    }

    if(panToMarker) {
      mapInstance.setView([lat, lon], Math.max(mapInstance.getZoom(), 9));
    }
  }

  destroySessionMap(sessionId:string) {
    const marker = this.sessionMarkerBySessionId.get(sessionId);
    if(marker) {
      marker.remove();
      this.sessionMarkerBySessionId.delete(sessionId);
    }
    const mapInstance = this.sessionMapBySessionId.get(sessionId);
    if(mapInstance) {
      mapInstance.remove();
      this.sessionMapBySessionId.delete(sessionId);
    }
    delete this.locationSearchQueryBySessionId[sessionId];
    delete this.locationSearchResultsBySessionId[sessionId];
    delete this.locationSearchInProgressBySessionId[sessionId];
  }

  addAnnotLevel(name = "", type = "ITEM") {
    const annotLevel = this.fb.group({
      name: new FormControl(name, {
        validators: [Validators.required, Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      } ),
      type: new FormControl(type, Validators.required)
    });
    this.annotLevelForms.push(annotLevel);
  }

  validateAnnotLevelNameUnique(control: AbstractControl): {[key: string]: any} | null  {
    for(let key in control.value) {
      for(let key2 in control.value) {
        if(control.value[key].name == control.value[key2].name && key != key2) {
          return { 'annotLevelNameNotUnique': true };
        }
      }
    }
    return null;
  }

  deleteAnnotLevel(index) {
    if(window.confirm("Are you sure you wish to delete this annotation level? This will also delete all links to and from this annotation level.")) {
      //Delete any links which reference this annotLevel
      for(let key in this.annotLevelLinks.controls) {
        let keyNum:number = +key;
        let annotLevelLink:any = this.annotLevelLinks.controls[key];
        let annotLevelForm:any = this.annotLevelForms.at(index);
        if(annotLevelLink.controls.superLevel.value == annotLevelForm.controls.name.value || annotLevelLink.controls.subLevel.value == annotLevelForm.controls.name.value) {
          this.annotLevelLinks.removeAt(keyNum);
        }
      }
      
      this.annotLevelForms.removeAt(index);
    }
  }

  addAnnotLevelLink(superLevel = null, subLevel = null, type = "ONE_TO_MANY") {
    const annotLevelLink = this.fb.group({
      superLevel: new FormControl(superLevel, Validators.required),
      subLevel: new FormControl(subLevel, Validators.required),
      type: new FormControl(type, Validators.required)
    });
    this.annotLevelLinkForms.push(annotLevelLink);
  }

  validateAnnotLevelLinkNotToSame(control: AbstractControl): {[key: string]: any} | null  {
    for(let key in control.value) {
      if(control.value[key].superLevel == control.value[key].subLevel) {
        return { 'annotLevelLinkCyclic': true };
      }
    }
    return null;
  }

  deleteAnnotLevelLink(index) {
    if(window.confirm("Are you sure you wish to delete this annotation level link?")) {
      this.annotLevelLinkForms.removeAt(index);
    }
  }

  emuSessionNameIsAvailable(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let sessionNameTaken:boolean = false;
      if(this.storedEmuDb == null) {
        return null;
      }
      for(let key in this.storedEmuDb.sessions) {
        if(this.storedEmuDb.sessions[key].name == control.value) {
          sessionNameTaken = true;
        }
      }
      return sessionNameTaken ? { 'sessionNameTaken': sessionNameTaken } : null;
    };
  }

  async fetchSprScripts() {
    let user = this.userService.getSession();
    return new Promise((resolve, reject) => {
      //fetch the speech recorder scripts from the server
      this.projectService.fetchSprScripts(user.username).subscribe((sessionScriptOptions:any) => {
        this.sessionScriptOptions = [];
        sessionScriptOptions.result.forEach(sessionScriptOption => {
          this.sessionScriptOptions.push({
            label: sessionScriptOption.name,
            value: sessionScriptOption.scriptId
          });
        });

        resolve(this.sessionScriptOptions);
      });
    });
  }

  async addSession(session = null) {
    if (this.isAddingSession) {
      return null;
    }
    this.isAddingSession = true;
    try {
    await this.fetchSprScripts();

    let files = [];
    if(session == null) {
      let sessionNumber = 1;
      let defaultSessionName = "Recording session "+sessionNumber;
      while(this.sessions.controls.find(s => s.get('name').value == defaultSessionName)) {
        sessionNumber++;
        defaultSessionName = "Recording session "+sessionNumber;
      }

      session = {
        id: nanoid(),
        name: defaultSessionName,
        speakerGender: null,
        speakerAge: 35,
        timeOfRecording: null,
        placeOfRecording: "",
        dataSource: "upload",
        new: true,
        collapsed: false,
        sprSessionSealed: false,
      }
    }
    else {
      let sprSession = null;
      if(session.dataSource == "record") {
        sprSession = await new Promise((resolve, reject) => {
          this.projectService.fetchSprSession(session.id).subscribe({
            next: (cmdResponse:any) => {
              resolve(cmdResponse.data);
            },
            error: (error) => {
              console.log(error);
              this.notifierService.notify("error", "Could not fetch speech recorder session data");
              resolve(null);
            }
          });
        });
        
        if(sprSession) {
          session.sprSessionSealed = sprSession.sealed;
        }
      }
      
      session.name = session.sessionName ? session.sessionName : session.name;
      session.new = false;
      session.collapsed = true;
      session.timeOfRecording = this.formatDateTimeForInput(session.timeOfRecording);
      session.placeOfRecording = session.placeOfRecording || "";
      session.files.forEach(file => {
        files.push({
          name: file.name,
          uploadComplete: true
        });
      });
    }

    //Make sure we're not adding a session with the same name as another existing session - this is not allowed
    //session names MUST be unique, even in the form
    let abort = false;
    this.sessions.controls.forEach(formGroup => {
      let fg = formGroup as FormGroup;
      if(fg.controls.name.value == session.name) {
        if(session.name == "") {
          this.notifierService.notify("warning", "Cannot add more than one unnamed session at the same time.");
        }
        if(session.name != "") {
          this.notifierService.notify("warning", "Cannot add session. Session name conflict.");
        }
        abort = true;
      }
    });
    if(abort) {
      return null;
    }

    let defaultScript = this.sessionScriptOptions.length > 0 ? this.sessionScriptOptions[0] : { value: null, label: "No script" };

    let dataSourceControl = new FormControl(session.dataSource);

    const sessionGroup = this.fb.group({
      new: new FormControl(session.new),
      deleted: new FormControl(false),
      id: new FormControl(session.id),
      name: new FormControl({ value: session.name, disabled: !session.new}, {
        validators: [Validators.required, Validators.maxLength(30), Validators.minLength(2), Validators.pattern("[a-zA-Z0-9 \\\-_]*"), this.emuSessionNameIsAvailable()],
        updateOn: 'blur'
      }),
      speakerGender: new FormControl(session.speakerGender, {
        updateOn: 'blur'
      }),
      speakerAge: new FormControl(session.speakerAge, {
        validators: [Validators.pattern("[0-9]*"), Validators.nullValidator],
        updateOn: 'blur'
      }),
      timeOfRecording: new FormControl(session.timeOfRecording),
      placeOfRecording: new FormControl(session.placeOfRecording, {
        validators: [this.validateCoordinatesIfProvided.bind(this)],
        updateOn: 'blur'
      }),
      dataSource: dataSourceControl, //upload or record
      recordingLink: new FormControl({value: this.getRecordingSessionLink(session.id), disabled: true}), //"https://"+window.location.hostname+"/spr/session/"+session.sessionId
      sessionScript: new FormControl( defaultScript.value, this.validateSprScriptWithParent(dataSourceControl)),
      files: this.fb.array(files),
      collapsed: new FormControl(session.collapsed),
      sprSessionSealed: new FormControl(session.sprSessionSealed),
    });


    await new Promise((resolve, reject) => {
      //fetch the spr session from the mongodb based on session.meta.SessionId
      this.projectService.fetchSprScriptBySessionId(session.id).subscribe((data:any) => {
        let sprScript = data.data;
        if(sprScript != null) {
          sessionGroup.controls.sessionScript.setValue(sprScript.scriptId);
          resolve(sprScript);
        }
        else {
          sessionGroup.controls.sessionScript.setValue(defaultScript.value);
          resolve(null);
        }
      });
    });

    const sessionId = String(sessionGroup.controls.id.value);
    this.locationSearchQueryBySessionId[sessionId] = session.placeOfRecording || "";
    this.locationSearchResultsBySessionId[sessionId] = [];

    

    if(session.new) {
      this.sessions.insert(0, sessionGroup);
    }
    else {
      this.sessions.push(sessionGroup);
    }
    } finally {
      this.isAddingSession = false;
    }
  }

  deleteAllBundles(projectId, sessionId) {
    //confirm deletion
    if(!window.confirm("Are you sure you wish to delete all the audio files in this session?")) {
      return;
    }
    
    //loop through all the files in the form and delete them 
    this.sessions.controls.forEach(session => {
      let sessionFormGroup = session as FormGroup;
      if(sessionFormGroup.controls.id.value == sessionId) {
        sessionFormGroup.controls.files.value.forEach(file => {
          this.projectService.deleteBundle(projectId, sessionId, file.name).subscribe((data:any) => {
            if(data.result === false) {
              this.notifierService.notify("error", "Could not delete file "+file.name);
            }
          });
        });
      }
    });
    
    //clear the form
    this.sessions.controls.forEach(session => {
      let sessionFormGroup = session as FormGroup;
      if (sessionFormGroup.controls.id.value == sessionId) {
        const filesFormArray = sessionFormGroup.get('files') as FormArray;
        filesFormArray.clear();
      }
    });
  }

  downloadBundle(projectId, sessionId, fileName) {
    this.projectService.downloadBundle(projectId, sessionId, fileName).subscribe((response:any) => {
      if(response.result === false) {
        this.notifierService.notify("error", "Could not download file "+fileName);
      }
      else {
        this.notifierService.notify("info", "File "+fileName+" downloaded");
        let base64 = response.data.file;
        let binaryString = window.atob(base64);
        let binaryLen = binaryString.length;
        let bytes = new Uint8Array(binaryLen);
        for (let i = 0; i < binaryLen; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        let blob = new Blob([bytes], { type: 'application/octet-stream' });
        let url = window.URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = response.data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    });
  }

  deleteBundle(projectId, sessionId, fileName) {
    //confirm deletion
    if(!window.confirm("Are you sure you wish to delete the file "+fileName+"?")) {
      return;
    }
    
    this.projectService.deleteBundle(projectId, sessionId, fileName).subscribe((data:any) => {
      if(data.result !== false) {
        this.notifierService.notify("info", "File "+fileName+" deleted");

        //now delete the file from the form
        this.sessions.controls.forEach(session => {
          let sessionFormGroup = session as FormGroup;
          if(sessionFormGroup.controls.id.value == sessionId) {
            sessionFormGroup.controls.files.value.forEach(file => {
              if(file.name == fileName) {
                let fileIndex = sessionFormGroup.controls.files.value.indexOf(file);
                sessionFormGroup.controls.files.value.splice(fileIndex, 1);
              }
            });
          }
        });
        
      }
      else {
        this.notifierService.notify("error", data.message);
      }
    });
  }

  getRecordingSessionLink(sessionId) {
    return "https://"+window.location.hostname+"/spr/session/"+sessionId;
  }

  copyRecordingLink(link: string): void {
    const copySuccessful = this.copyToClipboard(link);
    if (copySuccessful) {
      this.notifierService.notify('info', 'Recording link copied to clipboard.');
    } else {
      this.notifierService.notify('error', 'Failed to copy recording link to clipboard.');
    }
  }

  private copyToClipboard(text: string): boolean {
    try {
      if (this.clipboard.copy(text)) {
        return true;
      }
    } catch (err) {
      console.error('Could not copy text via Clipboard service: ', err);
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copySuccessful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copySuccessful;
    } catch (err) {
      console.error('Could not copy text via fallback: ', err);
      return false;
    }
  }

  toggleSessionCollapsed(sessionName) {
    this.sessions.controls.forEach(group => {
      let g = group as FormGroup;
      if(sessionName == g.controls.name.value) {
        const nextCollapsedState = !g.controls.collapsed.value;
        g.controls.collapsed.setValue(nextCollapsedState);
        if(!nextCollapsedState) {
          setTimeout(() => {
            const sessionId = String(g.controls.id.value);
            const mapInstance = this.sessionMapBySessionId.get(sessionId);
            if(mapInstance) {
              mapInstance.invalidateSize();
            }
          }, 0);
        }
      }
    });
  }

  validateSessionNameUnique(control: AbstractControl): {[key: string]: any} | null  {
    let fa = control as FormArray;

    let returnVal = null;
    fa.controls.forEach((c) => {
      let fg = c as FormGroup;
      
      fa.controls.forEach((c2) => {
        let fg2 = c2 as FormGroup;
        //If same name and not same object...
        if(fg.controls.name.value == fg2.controls.name.value && fg.controls.name != fg2.controls.name) {
          returnVal = { 'sessionNameNotUnique': true };
        }
      });
    });
    return returnVal;
  }

  validateSprScriptWithParent(dataSourceControl: AbstractControl): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const isRecordingSession = dataSourceControl.value === "record";
      if (isRecordingSession && control.value == null) {
        return { 'sprScriptNotSelected': true };
      }
      return null;
    };
  }

  deleteSession(index, evt = null) {
    if(evt) {
      evt.stopPropagation();
    }
    let sessionFormGroup = this.sessionForms.at(index) as FormGroup;
    const sessionId = String(sessionFormGroup.controls.id.value);
    if(!sessionFormGroup.controls.new.value) {
      if(window.confirm("Are you sure you wish to delete this session and all its associated data? The session will not be erased from the version controlled history, but it will no longer show up in the user interface.")) {
        let session = this.sessionForms.at(index) as FormGroup;
        session.controls.deleted.setValue(true); //mark this session as deleted so that when the form is saved, we know what to delete from gitlab without having to fetch all the sessions and compare
        this.destroySessionMap(sessionId);
        //this.sessionForms.removeAt(index);
      }
    }
    else {
      this.destroySessionMap(sessionId);
      this.sessionForms.removeAt(index);
    }
  }

  onAudioUpload(event, session) {
    /*
    let allowedFilesTypes = ['audio/wav', 'audio/x-wav', 'application/zip', 'application/x-zip-compressed'];
    
    for(let key in event.addedFiles) {
      if(allowedFilesTypes.includes(event.addedFiles[key].type) == false) {
        this.notifierService.notify('warning', 'The file ' + event.addedFiles[key].name + ' is of an invalid type ' + event.addedFiles[key].type + '. Please only upload WAV files here.');
        event.addedFiles.splice(key, 1);
      }
    }
    */

    if(event.addedFiles.length == 0) {
      return;
    }

    session.value.files.push(...event.addedFiles);

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file, session).then((uploadResultData:any) => {
        if(uploadResultData.code != 200) {
          this.notifierService.notify('error', file.name + ': ' + uploadResultData.body);

          //remove the file from the form
          for(let key in session.value.files) {
            if(session.value.files[key].name == file.name) {
              session.value.files.splice(key, 1);
            }
          }
        }
        else {
          console.log("upload done");
        }
        
      })
    }

    //dispatch event
    window.dispatchEvent(new Event('audioUpload'));    
  }

  async uploadFile(file:File, session) {
    return await this.fileUploadService.upload(file, this.formContextId, "emudb-sessions/"+session.controls.id.value);
  }
  
  onRemove(file, session) {
    this.fileUploadService.cancelUpload(file);
    for(let key in session.value.files) {
      if(session.value.files[key].name == file.name) {
        session.value.files.splice(key, 1);
      }
    }
    //TODO: Remove the uploaded file from the server? - hah! as if...
  }

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

  shutdownSession() {
    this.projectService.shutdownSession(this.sessionAccessCode).subscribe(msg => {
      if(!msg.data) {
        return;
      }
      let msgDataPkt = JSON.parse(msg.data);
      if(msgDataPkt.type == "cmd-result" && msgDataPkt.cmd == "shutdownSession") {
        if(msgDataPkt.progress != "end") {
          console.warn("Something went wrong with shutting down container session");
        }
      }
    });
  }

  resetForm() {
    this.sessionForms.controls.forEach((sessionControl) => {
      const sessionGroup = sessionControl as FormGroup;
      this.destroySessionMap(String(sessionGroup.controls.id.value));
    });

    while(this.sessions.length > 0) {
      this.sessions.removeAt(0);
    }

    while(this.annotLevels.length > 0) {
      this.annotLevels.removeAt(0);
    }

    while(this.annotLevelLinks.length > 0) {
      this.annotLevelLinks.removeAt(0);
    }
  }


  get annotLevelsForm() {
    return this.annotLevels.value as FormArray;
  }

  get sessionForms() {
    return this.form.get('sessions') as FormArray;
  }

  get annotLevelForms() {
    return this.form.get('annotLevels') as FormArray;
  }

  get annotLevelLinkForms() {
    return this.form.get('annotLevelLinks') as FormArray;
  }

  submit() {
    console.log("submit");
  }

  openSprScriptsDialog(project) {
    //confirm
    if(!window.confirm("Are you sure you wish to open the speech recorder scripts dialog? This will close the current dialog and you will lose any unsaved changes.")) {
      return;
    }
    
    this.projectManager.showSprScriptsDialog(project);
  }

}
