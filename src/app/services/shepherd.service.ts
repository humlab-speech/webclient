import { Injectable } from '@angular/core';
import ShepherdBase from 'shepherd.js';

@Injectable({
  providedIn: 'root'
})
export class ShepherdService {
  private tour: ShepherdBase.Tour | null = null;

  private readonly selectors = {
    createProjectButton: '#tutorial-create-project-btn',
    projectNameFieldset: '#tutorial-project-name-fieldset',
    sessionsForm: '#sessions-container',
    sessionNameInput: '#sessions-container .tutorial-session-name-input',
    audioDropzone: '#sessions-container .tutorial-audio-dropzone',
    submitButton: '#submitBtn',
    firstProjectCard: '#project-manager-root .project-list app-project-item:first-child .tutorial-project-card',
    firstProjectOperations: '#project-manager-root .project-list app-project-item:first-child .tutorial-project-operations',
    firstProjectApplications: '#project-manager-root .project-list app-project-item:first-child .tutorial-project-applications'
  };

  private readonly onProjectSaved = () => {
    this.showStepAfterDelay('project-saved', 'project-save-processing');
  };

  private readonly onAudioUpload = () => {
    this.showStepAfterDelay('save-project', 'audio-upload');
  };

  constructor() {}

  private waitForElement(selector: string, timeoutMs: number = 6000): Promise<void> {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          window.clearTimeout(timeoutHandle);
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      const timeoutHandle = window.setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeoutMs);
    });
  }

  private showStepAfterDelay(stepId: string, expectedCurrentStepId: string | null = null, delayMs: number = 450): void {
    window.setTimeout(() => {
      if (!this.tour || !this.tour.isActive()) {
        return;
      }

      if (expectedCurrentStepId && this.tour.getCurrentStep()?.id !== expectedCurrentStepId) {
        return;
      }

      if (this.tour.getById(stepId)) {
        this.tour.show(stepId);
      }
    }, delayMs);
  }

  private bindWindowTutorialListeners(): void {
    this.unbindWindowTutorialListeners();
    window.addEventListener('projectSaved', this.onProjectSaved);
    window.addEventListener('audioUpload', this.onAudioUpload);
  }

  private unbindWindowTutorialListeners(): void {
    window.removeEventListener('projectSaved', this.onProjectSaved);
    window.removeEventListener('audioUpload', this.onAudioUpload);
  }

  public initializeGeneralTour() {
    this.unbindWindowTutorialListeners();

    this.tour = new ShepherdBase.Tour({
      defaultStepOptions: {
        classes: 'shepherd-theme-arrows',
        scrollTo: false
      },
      useModalOverlay: true
    });

    this.bindWindowTutorialListeners();

    this.tour.on('cancel', () => {
      this.unbindWindowTutorialListeners();
    });

    this.tour.on('complete', () => {
      this.unbindWindowTutorialListeners();
    });

    this.tour.addStep({
      id: 'tutorial-intro',
      text: `Welcome to Visible Speech!
      <br /><br />
      Visible Speech lets you record, analyze, and visualize speech data online, by binding together various tools. It is based on the EMU-SDMS framework for speech analysis.
      <br /><br />
      This tutorial will guide you through the main features of the application. We will start by creating an example project.
      `,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    this.tour.addStep({
      id: 'create-project',
      text: `Please click the 'New project' button to continue.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.createProjectButton),
      attachTo: {
        element: this.selectors.createProjectButton,
        on: 'bottom'
      },
      advanceOn: {
        selector: this.selectors.createProjectButton,
        event: 'click'
      }
    });

    this.tour.addStep({
      id: 'project-name',
      text: `Please enter a name for your project and click 'Next'.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.projectNameFieldset),
      attachTo: {
        element: this.selectors.projectNameFieldset,
        on: 'bottom'
      }
    });

    this.tour.addStep({
      id: 'sessions-overview',
      text: `Here we will add a recording session to the project. A recording session in an EmuDB project is a collection of audio files with associated metadata.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.sessionsForm),
      attachTo: {
        element: this.selectors.sessionsForm,
        on: 'top'
      }
    });

    this.tour.addStep({
      id: 'session-name',
      text: `Enter a name for the recording session and click 'Next'.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.sessionNameInput),
      attachTo: {
        element: this.selectors.sessionNameInput
      }
    });

    this.tour.addStep({
      id: 'audio-upload',
      text: `
      Here we select the source of our audio files in this session. You can either upload audio files from your computer or record audio directly in the browser.
      If you choose 'Recording session' you will be able to assign a recording script and you will be given a link to share with the speaker which will initiate the recording process.
      <br /><br />
      Let's choose 'Uploaded files' for now and drop in a wav file. If you do not have a wav file of your own, you can download an example file here:
      <a href='https://visp.humlab.umu.se/LS010003sentence1.wav' target='_blank'>LS010003sentence1.wav</a>
      `,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.audioDropzone),
      attachTo: {
        element: this.selectors.audioDropzone,
        on: 'top'
      },
      scrollTo: true
    });

    this.tour.addStep({
      id: 'save-project',
      text: `Click the 'Save' button to create the project.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.submitButton),
      advanceOn: {
        selector: this.selectors.submitButton,
        event: 'click'
      },
      attachTo: {
        element: this.selectors.submitButton,
        on: 'top'
      },
      scrollTo: true
    });

    this.tour.addStep({
      id: 'project-save-processing',
      text: `Please wait for the project to be created. This will take a moment.`
    });

    this.tour.addStep({
      id: 'project-saved',
      text: `Now that we have a project, let's see what we can do with it.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.firstProjectCard),
      attachTo: {
        element: this.selectors.firstProjectCard
      }
    });

    this.tour.addStep({
      id: 'project-operations',
      text: `Here is where you control project operations, such as managing sessions, assigning annotation tasks, and managing project members.`,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.firstProjectOperations),
      attachTo: {
        element: this.selectors.firstProjectOperations,
        on: 'bottom'
      }
    });

    this.tour.addStep({
      id: 'project-applications',
      text: `
      These are your tools for working with your project. You can launch the transcription tool and Jupyter notebook from here.
      <br /><br />
      Jupyter notebook can be used to run analyses against the files in your project using the EMU-R library.
      <br /><br />
      The transcription tool is where you can visualize, annotate and analyze your speech data.
      `,
      buttons: [
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.firstProjectApplications),
      attachTo: {
        element: this.selectors.firstProjectApplications,
        on: 'bottom'
      }
    });

    this.tour.addStep({
      id: 'tutorial-complete',
      text: `This concludes the tutorial. If you have any questions, please contact us at <a href='mailto:support@humlab.umu.se'>support@humlab.umu.se</a>.`,
      buttons: [
        {
          text: 'Finish',
          action: this.tour.complete
        }
      ],
      beforeShowPromise: () => this.waitForElement(this.selectors.firstProjectApplications),
      attachTo: {
        element: this.selectors.firstProjectApplications,
        on: 'bottom'
      }
    });
  }

  public startTour(tourName: string = null) {
    if (this.tour && this.tour.isActive()) {
      this.tour.cancel();
    }

    switch (tourName) {
      default:
        this.initializeGeneralTour();
    }

    this.tour.start();
  }

  public nextStep() {
    this.tour?.next();
  }

  public backStep() {
    this.tour?.back();
  }

  public cancelTour() {
    this.tour?.cancel();
  }
}
