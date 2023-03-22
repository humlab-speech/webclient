// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    APPLICATION_NAME: "Visible Speech",
    LOGO_IMAGE_PATH: "/assets/VISP-logo-white.png",
    API_ENDPOINT: "visp.local",
    EMUDB_INTEGRATION: true,
    ENABLED_APPLICATIONS: ["rstudio", "jupyter", "emu-webapp", "octra", "script"],
    BASE_DOMAIN: "visp.local",
    GITLAB_API_ENDPOINT: "gitlab.visp.local/api/v4",
    GITLAB_PERSONAL_ACCESS_TOKEN: null,
    ACCESS_LIST_ENABLED: true,
    PROTOCOL: "https",
    production: false
  };
  
  /*
   * For easier debugging in development mode, you can import the following file
   * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
   *
   * This import should be commented out in production mode because it will have a negative impact
   * on performance if an error is thrown.
   */
  // import 'zone.js/dist/zone-error';  // Included with Angular CLI.
  