export class Config {
    public static APPLICATION_NAME = "Visible Speech";
    public static API_ENDPOINT = "localtest.me";
    public static EMUDB_INTEGRATION = true;
    public static ENABLED_APPLICATIONS = ["rstudio", "jupyter", "emu-webapp", "octra", "script"];
    public static BASE_DOMAIN = "localtest.me";
    public static GITLAB_API_ENDPOINT = "gitlab."+Config.BASE_DOMAIN+"/api/v4";
    public GITLAB_PERSONAL_ACCESS_TOKEN = null;
}
