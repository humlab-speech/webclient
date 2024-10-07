import { Injectable } from '@angular/core';
import ShepherdBase from 'shepherd.js';

@Injectable({
  providedIn: 'root'
})
export class ShepherdService {

  private tour: ShepherdBase.Tour;

  constructor() { 
  }
  
  public initializeGeneralTour() {

    window.addEventListener('projectSaved', () => {
      setTimeout(() => {
        this.tour.show('project-saved');
      }, 500);
    });

    window.addEventListener('emu-webbapp-launched', () => {
      setTimeout(() => {
        this.tour.show('app-launched-emu-webapp');
      }, 500);
    });

    window.addEventListener('audioUpload', () => {
      setTimeout(() => {
        this.tour.show('annotation-levels');
      }, 500);
    });

    this.tour = new ShepherdBase.Tour({
      defaultStepOptions: {
        classes: 'shepherd-theme-arrows',
        scrollTo: false,
      },
      useModalOverlay: true,
    });

    this.tour.addStep({
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
        },/*
        {
          text: 'Skip project creation',
          action: () => { this.tour.show('project-saved'); }
        }
          */
      ],
    });

    this.tour.addStep({
      text: `
      Please click the 'Create new project' button to continue
      `,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
      ],
      attachTo: {
        element: '#project-manager-root > div > div',
      },
      advanceOn: {
        selector: '#create-project-btn',
        event: 'click'
      }
    });

    this.tour.addStep({
      text: `
      Please enter a name for your project and click 'Next'.
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
      ],
      attachTo: {
        element: '#project-manager-root > app-project-dialog > div > div > form > fieldset',
        on: 'bottom'
      },
    });

    this.tour.addStep({
      text: `
      Here you can drop any documents you might have that are associated with the project, such as your data management plan. However this is completely optional. Click 'Next' to continue.
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
      ],
      attachTo: {
        element: '#project-manager-root > app-project-dialog > div > div > form > app-documentation-form > div',
      },
    });
    

    this.tour.addStep({
      text: `
      Here we will add a session to project. A 'session' in the context of a EmuDB project is a collection of audio files with some associated metadata. 
      
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
      ],
      attachTo: {
        element: '#project-manager-root > app-project-dialog > div > div > form > app-sessions-form > div',
        on: 'top'
      },
    });

    this.tour.addStep({
      text: `
      Enter a name for the session and click 'Next'.
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
      ],
      attachTo: {
        element: '#sessions-container > div > div > div.section-content > div.session-metadata-container > div:nth-child(1)',
      },
    });

    this.tour.addStep({
      text: `
      Here you can enter some metadata about who speaks in this session. However this is entirely optional. Click 'Next' to continue.
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
      ],
      attachTo: {
        element: '#sessions-container > div > div > div.section-content > div.session-metadata-container > div:nth-child(3)',
        on: 'top'
      },
    });

    this.tour.addStep({
      id: "audio-upload",
      text: `
      Here we select the source of our audio files in this session. You can either upload audio files from your computer or record audio directly in the browser.
      If you choose 'Recording session' you will be able to assign a recording script and you will be given a link to share with the speaker which will initiate the recording process.
      <br /><br />
      Let's choose 'Upload audio files' for now and drop in a wav file. If you do not have a wav file of your own, you can download an example file here: 
      <a href='https://visp.humlab.umu.se/LS010003sentence1.wav' target='_blank'>LS010003sentence1.wav</a>
       <br /><br />
      Click 'Next' to continue.
      `,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        }
      ],
      attachTo: {
        element: '#sessions-container > div > div > div.section-content > div:nth-child(2)',
        on: 'top'
      },
      scrollTo: true,
    });

    this.tour.addStep({
      id: "annotation-levels",
      text: `
      This section houses settings for annotation levels and links, which affect how the audio files in this session will be organized in the EMU-WebApp. Let's leave it as is for now.
       <br /><br />
      Click 'Next' to continue.
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
      ],
      attachTo: {
        element: '#project-manager-root > app-project-dialog > div > div > form > app-sessions-form > div > h3:nth-child(3)',
        on: 'top'
      },
    });

    this.tour.addStep({
      text: `
      Click the 'Save' button to create the project.
      `,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
      ],
      advanceOn: {
        selector: '#submitBtn',
        event: 'click'
      },
      scrollTo: true,
      attachTo: {
        element: '#submitBtn',
        on: 'top'
      },
    });

    this.tour.addStep({
      text: `
      Please wait for the project to be created. This will take a few seconds.
      `,
    });

    this.tour.addStep({
      id: 'project-saved',
      text: `
      Now that we have a project, let's see what we can do with it.
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
      ],
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1)'
      },
    });

    this.tour.addStep({
      text: `
      Here is where you control the project settings, such as adding new recording sessions, assign annotation tasks, and add or remove project members.
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
      ],
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.gitlab-project-container',
        on: 'bottom'
      },
    });

    this.tour.addStep({
      text: `
      These are your tools for working with your project. You can launch the EMU-WebApp, Jupyter notebook, or RStudio from here.
      <br /><br />
      Jupyter notebook and RStudio can be used in a similar way to run R code against the files in your project to perform various types of analyses using the EMU-R library.
      <br /><br />
      The EMU-WebApp is where you can visualize, annotate and analyze your speech data.
      <br /><br />
      
      `,
      buttons: [
        {
          text: 'Next',
          action: this.tour.next
        }
      ],
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container',
        on: 'bottom'
      },
    });

    this.tour.addStep({
      text: `
      This concludes the tutorial. If you have any questions, please contact us at <a href='mailto:support@humlab.umu.se'>
      `,
      buttons: [
        {
          text: 'Finish',
          action: this.tour.complete
        }
      ],
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container',
        on: 'bottom'
      },
    });


    /*
    this.tour.addStep({
      text: `
      Let's go into the transcription tool (EMU-WebApp) and see how it works. Click the button to continue.
      `,
      buttons: [
        {
          text: 'Abort',
          action: this.tour.cancel,
          classes: 'tutorial-exit-btn'
        },
      ],
      advanceOn: {
        selector: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container > div:nth-child(2) > app-appctrl > fieldset > div > button',
        event: 'click'
      },
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container > div:nth-child(2) > app-appctrl > fieldset > div',
        on: 'bottom'
      },
    });


    this.tour.addStep({
      id: 'emu-webbapp',
      text: `
      This is the EMU-WebApp where you can visualize and analyze speech data. We won't go into detail here, but feel free to explore the interface. When you are ready to go back to the dashboard, click the 'Back to dashboard' button in the upper left corner and the tutorial will continue.
      `,
      buttons: [
        {
          text: 'Ok',
          action: this.tour.hide,
        },
      ],
    });
    */

    //This concludes the tutorial. If you have any questions, please contact us at <a href='mailto:support@humlab.umu.se'>support@humlab.umu.se</a>

    //######################################

    /*
    this.tour.addStep({
      text: `
      Visible Speech lets you record, analyze, and visualize speech data online, by binding together various tools such as the EMU-SDMS framework for speech analysis and the WebSpeechRecorder application.
      Let's walk through the main parts of this interface.
      `,
      buttons: [
        {
          text: 'Exit',
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
      text: `This is the project manager. Here you can create, edit and delete projects, as well as add and remove project members.
      <br /><br />
      You can also launch tools for speech analysis and transcription. Let's have a closer look at each of them.`,
      attachTo: {
        element: 'app-project-manager',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `This is the EMU-WebApp where you can visualize and analyze speech data.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container > div:nth-child(2) > app-appctrl > fieldset',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `This is a Jupyter notebook where you can run R code against the files in your project to perform various types of analyses using the EMU-R library.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container > div:nth-child(3) > app-appctrl',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `This is RStudio which can be used alternatively to Jupyter notebook in a similar way.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.applications-container > div:nth-child(4) > app-appctrl',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `Here you can add or remove sessions in your project. A session is a collection of audio files with some associated metadata.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.gitlab-project-container > div > ul > li:nth-child(1) > div',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `Here you can assign annotation tasks to other project members (or yourself). This controls which audio files (or 'bundles' as they are called within the EMU-SDMS framework) that will show up in the transcription tool (EMU-WebApp) for each user.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.gitlab-project-container > div > ul > li:nth-child(2) > div',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `This is where you add/remove members from your project.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.gitlab-project-container > div > ul > li:nth-child(3) > div',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `Here you can create or edit the recording scripts used in the online speech recording application. A script in this context is a set of prompts or instructions for the speaker to follow during the recording.<br /><br />
      You use these scripts by creating a new session in your project of the recording type, and associating the script with that session.`,
      attachTo: {
        element: '#project-manager-root > ul > app-project-item:nth-child(1) > li > div.project-main-panel > div.gitlab-project-container > div > ul > li:nth-child(4) > div',
      },
      buttons: [
        {
          text: 'Exit',
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
      text: `Let's go over the 'Create new project dialog' in detail. Please click on the 'Create new project' button.`,
      attachTo: {
        element: '#create-project-btn',
      },
      buttons: [
        {
          text: 'Exit',
          action: this.tour.cancel
        },
      ]
    });
    */
    
  }

  public startTour(tourName:string = null) {
    console.log("Starting tour: " + tourName);
    switch(tourName) {
      default:
        this.initializeGeneralTour();
    }
    this.tour.start();
  }

  public nextStep() {
    this.tour.next();
  }

  public backStep() {
    this.tour.back();
  }

  public cancelTour() {
    this.tour.cancel();
  }
    
}
