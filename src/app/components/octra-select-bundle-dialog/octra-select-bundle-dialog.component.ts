import { Component, OnInit, Input } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';
import { BundleListItem } from '../../models/BundleListItem';
import { FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import Cookies from 'js-cookie';

@Component({
  selector: 'app-octra-select-bundle-dialog',
  templateUrl: './octra-select-bundle-dialog.component.html',
  styleUrl: './octra-select-bundle-dialog.component.scss'
})

export class OctraSelectBundleDialogComponent implements OnInit {

  @Input() project;

  modalService: ModalService;
  systemService: SystemService;
  userService: UserService;
  sessionOptions = [];
  bundleOptions = [];
  selectionForm: FormGroup;
  userBundleList: BundleListItem[] = [];

  constructor(modalService: ModalService, systemService: SystemService, userService: UserService, private router: Router) {
    this.modalService = modalService;
    this.systemService = systemService;
    this.userService = userService;
    this.router = router;

    this.selectionForm = new FormGroup({
      session: new FormControl(null),
      bundle: new FormControl({value: null, disabled: true})
    });
  }

  async ngOnInit(): Promise<void> {
    // Load sessions from project structure (filtered by user's bundle assignments)
    this.sessionOptions = await this.getProjectSessions();
    
    if (this.sessionOptions.length > 0) {
      this.selectionForm.get('session').setValue(this.sessionOptions[0].value);
      this.onFormSessionChange();
    }

    // Listen to session changes
    this.selectionForm.get('session').valueChanges.subscribe(() => {
      this.onFormSessionChange();
    });
  }

  onFormSessionChange(): void {
    const selectedSessionId = this.selectionForm.get('session').value;
    if (selectedSessionId) {
      this.bundleOptions = this.getSessionBundles(selectedSessionId);
      
      if (this.bundleOptions.length > 0) {
        this.selectionForm.get('bundle').enable();
        this.selectionForm.get('bundle').setValue(this.bundleOptions[0].value);
      } else {
        this.selectionForm.get('bundle').setValue(null);
        this.selectionForm.get('bundle').disable();
      }
    } else {
      this.bundleOptions = [];
      this.selectionForm.get('bundle').setValue(null);
      this.selectionForm.get('bundle').disable();
    }
  }

  getCurrentNavigation() {
    return this.systemService.getCurrentApplication();
  }

  async getProjectSessions() {
    // Extract sessions from the project structure
    if (!this.project || !this.project.sessions) {
      return [];
    }

    // Fetch the user's bundle list from the backend
    const username = this.userService.getSession()?.username;
    if (!username) {
      console.warn('User session not available');
      return [];
    }

    try {
      const bundleListResponse = await this.systemService.sendCommandToBackend({
        cmd: "fetchBundleList",
        projectId: this.project.id,
        username: username,
      });

      if (bundleListResponse.result && bundleListResponse.data?.data?.bundles) {
        this.userBundleList = bundleListResponse.data.data.bundles;
      }
    } catch (error) {
      console.error('Error fetching bundle list:', error);
      return [];
    }

    // Create a Set of session names that the user has bundles in
    const userSessionNames = new Set(
      this.userBundleList.map((bundle: BundleListItem) => bundle.session)
    );

    // Filter sessions to only include those where the user has at least one bundle
    const filteredSessions = this.project.sessions.filter((session: any) => 
      userSessionNames.has(session.name)
    );

    // Map sessions to options with value (session.id) and label (session.name)
    return filteredSessions.map((session: any) => ({
      value: session.id,
      label: session.name
    }));
  }

  getSessionBundles(sessionId: string) {
    // Find the session by ID in the project structure
    if (!this.project || !this.project.sessions) {
      return [];
    }

    const session = this.project.sessions.find((s: any) => s.id === sessionId);
    if (!session || !session.files) {
      return [];
    }

    // Get the session name to filter bundles
    const sessionName = session.name;

    // Filter to only include bundles that are in the user's bundle list for this session
    const userBundlesForSession = this.userBundleList
      .filter((bundle: BundleListItem) => bundle.session === sessionName);

    // Create a Set for efficient lookup - check both with and without extension
    const userBundleNames = new Set<string>();
    userBundlesForSession.forEach((bundle: any) => {
      // Add the fileName if it exists (full name with extension)
      if (bundle.fileName) {
        userBundleNames.add(bundle.fileName);
      }
      // Add the name (might be without extension)
      userBundleNames.add(bundle.name);
      // Add with .wav extension as fallback
      if (!bundle.name.endsWith('.wav')) {
        userBundleNames.add(bundle.name + '.wav');
      }
    });

    // Filter and map files to bundle options - only include bundles assigned to the user
    return session.files
      .filter((file: any) => userBundleNames.has(file.name))
      .map((file: any) => ({
        value: file.name,
        label: file.name
      }));
  }

  bundleSelected() {
    const selectedSessionId = this.selectionForm.get('session').value;
    const selectedBundle = this.selectionForm.get('bundle').value;
    
    console.log('Selected session ID:', selectedSessionId);
    console.log('Selected bundle:', selectedBundle);

    if (!selectedSessionId || !selectedBundle) {
      console.error('Session or bundle not selected');
      return;
    }

    /*
    we should now launch octra via an url that looks like this:
    https://octra.DOMAIN/visp-task/project/uz79uprps9osn3lz86jgo/session/kOtJ7gZl1Orydhp-0dPHf/bundle/same-goddamn-file.wav
    */

    console.log(this.project.id, selectedSessionId, selectedBundle);

    /**
     * what we really want to do here is to create a virtual "taskId" which will
     * be a combination of the project ID, session ID, and bundle name
     * we will store this in the mongodb in the octra_tasks collection
     * and then when the octra-server receives the request for "project xxx" it can fetch the xxx task from this collection
     * 
     **/

    //console.log("Re-routing to Octra");
    //this.router.navigate(['/octra']);
    
    //make backend request
    this.systemService.sendCommandToBackend({
      cmd: "createOctraTask",
      projectId: this.project.id,
      sessionId: selectedSessionId,
      bundleName: selectedBundle
    }).then((response: any) => {
      console.log('Task created:', response);

      response.data.annotationFile;

      //set octra task cookie
      Cookies.set('octraTask', response.data.taskId, { domain: window.location.hostname, secure: true, sameSite: 'None' });
      Cookies.set('octraTaskAnnotationFile', response.data.annotationFile, { domain: window.location.hostname, secure: true, sameSite: 'None' });
      console.log("Re-routing to Octra");
      this.router.navigate(['/octra']);
    });
    
  }

  closeDialog() {
    this.modalService.hideModal("octra-select-bundle-dialog");
  }
}
