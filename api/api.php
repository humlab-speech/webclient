<?php
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/SessionManagerInterface.class.php';
require_once __DIR__ . '/ApiResponse.class.php';

use MongoDB\Client;

$domain = ($_SERVER['HTTP_HOST'] != 'visp.local') ? $_SERVER['HTTP_HOST'] : false;
//if we are running on visp.local set cookie secure to false
$secure = ($_SERVER['HTTP_HOST'] != 'visp.local') ? true : false;
$httpOnly = false;

session_set_cookie_params(60*60*8, "/", $domain, $secure, $httpOnly);
session_start();

$hsApiAccessToken = getenv("HS_API_ACCESS_TOKEN");



class Application {
    function __construct($domain) {
        global $hsApiAccessToken;
        $this->sessionManagerInterface = new SessionManagerInterface($this, $hsApiAccessToken);
    }

    /**
     * Function: restMatchPath
     * 
     * Takes a request path and a REST path template and figures out if they match and extracts vars defined with :myvar
     * 
     */
    function restMatchPath($path, $template) {
        $regexp = $template;
        $varMatches = null;
        preg_match_all("/:[a-zA-Z0-9_]*/", $regexp, $varMatches);

        if(count($varMatches) > 0) {
            $varMatches = $varMatches[0];
            foreach($varMatches as $key => $vm) {
                $varMatches[$key] = str_replace(":", "", $varMatches[$key]);
            }
        }

        $regexp = "/".str_replace("/", "\/", $regexp);
        // Updated regex to match more characters including hyphens, percent-encoded chars, spaces, but NOT forward slashes
        // Forward slashes are path delimiters and should NOT be matched within a parameter
        $regexp = preg_replace("/(:[a-zA-Z0-9_]*)/", "([^\/]+)", $regexp);
        $regexp = $regexp . "$/"; // Anchor to end of string

        $matches = null;
        $match = preg_match($regexp, $path, $matches);
        
        if($match) {
            $varMap = [];
            foreach($varMatches as $key => $vm) {
                $varMap[$vm] = $matches[$key+1];
            }
            
            return ['matched' => true, 'varMap' => $varMap];
        }

        return ['matched' => false];
    }
    

    function route() {
        $apiResponse = false;
        $reqPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        //log the request
        $this->addLog("Request: ".$reqPath, "debug");
        $this->addLog("Request method: ".$_SERVER['REQUEST_METHOD'], "debug");
        
        //Special case for letting the session-manager validate & retrieve a PHP session
        if(isset($_GET['f']) && $_GET['f'] == "session") {
            $this->addLog("Session validation for ".$_COOKIE['PHPSESSID']." - ".session_id(), "debug");       
            //This might seem strange since there's no apparent authentication, but the authentication is implicit since the session-manager
            //must pass the correct PHPSESSID via a cookie header in order for the $_SESSION to be filled with the correct values
            //otherwise a new empty session will be returned

            if(!empty($_GET['projectId'])) {
                //if projectId is set, we also need to check that this user has access to that project
                if(!$this->userHasProjectAuthorization($_GET['projectId'])) {
                    $ar = new ApiResponse(401, array('message' => 'This user does not have access to that project.'));
                    return $ar->toJSON();
                }
            }

            $apiResponse = new ApiResponse(200, json_encode($_SESSION));
            return $apiResponse->toJSON();
        }

        $reqMethod = $_SERVER['REQUEST_METHOD'];

        //PUBLIC METHODS
        if($reqMethod == "GET") {
            switch($reqPath) {
                case "/api/v1/test":
                    $this->addLog("GET: /api/v1/test", "debug");
                    $ar = new ApiResponse(200, "Hello, this is the API");
                    return $ar->toJSON(false);
                break;
            }
        }

        if(empty($_SESSION['loginAllowed'])) {
            //if loginAllowed is not set, we need to fetch the complete session from the mongodb
            $this->addLog("Session not found in PHP session, fetching from MongoDB", "debug");

            $database = $this->getMongoDb();
            $collection = $database->selectCollection('users');
            $cursor = $collection->findOne(['phpSessionId' => session_id()]);
            if($cursor == null) { //empty result / not found
                $this->addLog("Session not found in database", "error");
                $ar = new ApiResponse(401, "Session ".session_id()." not found in database");
                echo $ar->toJSON();
                exit();
            }

            $this->addLog("Session found in database", "debug");
            $session = json_decode(json_encode(iterator_to_array($cursor)), TRUE);
            $_SESSION = $session;
        }

        //AUTH CONTROL - ALL METHODS BEYOND THIS POINT REQUIRES THE USER TO BE SIGNED-IN
        if(empty($_SESSION['loginAllowed']) || $_SESSION['loginAllowed'] !== true) {
            //if user has not passed a valid authentication, don't allow access to this API
            $this->addLog("User not signed in - Authorization required");
            $this->addLog("cookies: ".print_r($_COOKIE, true), "debug");
            $this->addLog("session: ".print_r($_SESSION, true), "debug");
            $ar = new ApiResponse(401, "Authorization required");
            echo $ar->toJSON();
            exit();
        }

        if($reqMethod == "GET") {

            $this->addLog("GET: ".$reqPath, "debug");

            $matchResult = $this->restMatchPath($reqPath, "/api/v1/session");
            if($matchResult['matched']) {
                $apiResponse = $this->getUserSessionAttributes();
            }
            
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/signout");
            if($matchResult['matched']) {
                $apiResponse = $this->signOut();
            }

            if($apiResponse !== false) {
                return $apiResponse->toJSON();
            }

            $matchResult = $this->restMatchPath($reqPath, "/api/v1/file/download/:octraTaskIdFile");
            if($matchResult['matched']) {

                //we handle exactly two types of files here that are both named after the octraTaskId, and they end with either .wav or _annot.json
                //so to get the octraTaskId we need to strip those suffixes
                $octraTaskId = "";
                if(substr($matchResult['varMap']['octraTaskIdFile'], -4) === '.wav') {
                    $octraTaskId = substr($matchResult['varMap']['octraTaskIdFile'], 0, -4);
                }
                else if(substr($matchResult['varMap']['octraTaskIdFile'], -11) === '_annot.json') {
                    $octraTaskId = substr($matchResult['varMap']['octraTaskIdFile'], 0, -11);
                }
                else {
                    return new ApiResponse(400, array('message' => 'Invalid file request.'));
                }

                $taskData = $this->getOctraTask($octraTaskId);
                if(!$taskData) {
                    return new ApiResponse(404, array('message' => 'Octra task not found.'));
                }
                $projectId = $taskData['projectId'];
                if($this->userHasProjectAuthorization($projectId)) {
                    $apiResponse = $this->getFileDownload($matchResult['varMap']);
                }
                else {
                    $apiResponse = new ApiResponse(401, array('message' => 'This user does not have access to that project.'));
                }
            }
        }

        if($reqMethod == "POST") {
            $postData = [];
            if(!empty($_POST['data'])) {
                $postData = json_decode($_POST['data']);
            }
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/upload");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/upload", "debug");
                $apiResponse = $this->handleUpload();
            }
            
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/operations/session/please");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/operations/session/please", "debug");
                if($this->userHasProjectAuthorization($postData->projectId)) {
                    $apiResponse = $this->sessionManagerInterface->fetchSession($postData->projectId, "operations");
                }
                else {
                    $apiResponse = new ApiResponse(401, array('message' => 'This user does not have access to that project.'));
                }
            }
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/jupyter/session/please");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/jupyter/session/please", "debug");
                if($this->userHasProjectAuthorization($postData->projectId)) {
                    $apiResponse = $this->sessionManagerInterface->fetchSession($postData->projectId, "jupyter");
                }
                else {
                    $apiResponse = new ApiResponse(401, array('message' => 'This user does not have access to that project.'));
                }
            }
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/vscode/session/please");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/vscode/session/please", "debug");
                if($this->userHasProjectAuthorization($postData->projectId)) {
                    $apiResponse = $this->sessionManagerInterface->fetchSession($postData->projectId, "vscode");
                }
                else {
                    $apiResponse = new ApiResponse(401, array('message' => 'This user does not have access to that project.'));
                }
            }
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/arctic/session/please");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/arctic/session/please", "debug");
                if($this->userHasProjectAuthorization($postData->projectId)) {
                    $apiResponse = new ApiResponse(200, array('personalAccessToken' => $_SESSION['personalAccessToken']));
                }
                else {
                    $apiResponse = new ApiResponse(401, array('message' => 'This user does not have access to that project.'));
                }
            }
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/session/save");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/session/save", "debug");
                if($this->userHasProjectAuthorization($postData->projectId)) {
                    $apiResponse = $this->sessionManagerInterface->commitSession($postData->sessionId);
                }
            }
            $matchResult = $this->restMatchPath($reqPath, "/api/v1/session/close");
            if($matchResult['matched']) {
                $this->addLog("POST: /api/v1/session/close", "debug");
                if($this->userHasProjectAuthorization($postData->projectId)) {
                    $apiResponse = $this->sessionManagerInterface->delSession($postData->sessionId);
                }
            }
            if($apiResponse !== false) {
                return $apiResponse->toJSON();
            }
            else {
                $this->addLog("No API response found for POST request", "error");
                $ar = new ApiResponse(400, "No API response found for POST request");
                return $ar->toJSON();
            }
        }
    }

    function getOctraTask($octraTaskId) {
        // Look up the task in MongoDB
        $database = $this->getMongoDb();
        $collection = $database->selectCollection('octravirtualtasks');
        $task = $collection->findOne(['id' => $octraTaskId]);

        if ($task == null) {
            $this->addLog("Octra task not found: $octraTaskId", "error");
            return false;
        }

        // Convert MongoDB document to array
        $taskData = json_decode(json_encode(iterator_to_array($task)), TRUE);
        
        $projectId = $taskData['projectId'];
        $sessionId = $taskData['sessionId'];
        $bundleName = $taskData['bundleName'];

        return $taskData;
    }

    function getFileDownload($varMap) {
        
        try {
            // Extract octraTaskId from URL
            $octraTaskId = urldecode($varMap['octraTaskIdFile']);
            
            // Determine if requesting annotation file or audio file
            $requestAnnotation = false;
            if (substr($octraTaskId, -11) === '_annot.json') {
                $requestAnnotation = true;
                $octraTaskId = substr($octraTaskId, 0, -11);
            } else if (substr($octraTaskId, -4) === '.wav') {
                $octraTaskId = substr($octraTaskId, 0, -4);
            }
            
            $this->addLog("File download request for octraTaskId: $octraTaskId (annotation: " . ($requestAnnotation ? 'yes' : 'no') . ")", "info");

            // Look up the task in MongoDB
            $taskData = $this->getOctraTask($octraTaskId);
            
            $projectId = $taskData['projectId'];
            $sessionId = $taskData['sessionId'];
            $bundleName = $taskData['bundleName'];
            
            $this->addLog("Task found - projectId: $projectId, sessionId: $sessionId, bundleName: $bundleName", "debug");

            // Construct the file path
            // The bundleName is the audio file name (e.g., 'prompt_1.wav')
            // We need to find the session and bundle directories
            $baseDir = '/repositories';
            
            // The file structure is: /repositories/{projectId}/Data/VISP_emuDB/{session_name}_ses/{bundle_name}_bndl/{file}.wav
            // We need to search for the session directory that matches sessionId and contains the bundle
            $projectPath = "{$baseDir}/{$projectId}/Data/VISP_emuDB";
            
            if (!is_dir($projectPath)) {
                $this->addLog("Project EmuDB directory not found: $projectPath", "error");
                return new ApiResponse(404, array('message' => 'Project data not found.'));
            }

            // Find the session directory
            $sessionFound = false;
            $fullPath = null;
            
            $sessions = glob($projectPath . "/*_ses");
            foreach ($sessions as $sessionDir) {
                // Check if this session contains a bundle with the bundleName
                $bundles = glob($sessionDir . "/*_bndl");
                foreach ($bundles as $bundleDir) {
                    $audioFile = $bundleDir . "/" . $bundleName;
                    if (file_exists($audioFile)) {
                        // If requesting annotation file, look for the _annot.json file
                        if ($requestAnnotation) {
                            // Extract base name without .wav extension
                            $baseFileName = pathinfo($bundleName, PATHINFO_FILENAME);
                            $annotFile = $bundleDir . "/" . $baseFileName . "_annot.json";
                            
                            if (file_exists($annotFile)) {
                                $fullPath = $annotFile;
                                $sessionFound = true;
                                break 2;
                            } else {
                                $this->addLog("Annotation file not found: $annotFile", "error");
                                return new ApiResponse(404, array('message' => 'Annotation file not found.'));
                            }
                        } else {
                            $fullPath = $audioFile;
                            $sessionFound = true;
                            break 2;
                        }
                    }
                }
            }

            if (!$sessionFound || $fullPath === null) {
                $fileType = $requestAnnotation ? 'Annotation' : 'Audio';
                $this->addLog("$fileType file not found for bundle: $bundleName in project $projectId", "error");
                return new ApiResponse(404, array('message' => "$fileType file not found."));
            }

            $this->addLog("Attempting to access file: $fullPath", "debug");

            // Security: Prevent directory traversal attacks
            $realPath = realpath($fullPath);

            $this->addLog("Real path: " . ($realPath ? $realPath : "FALSE"), "debug");

            if ($realPath === false || strpos($realPath, $baseDir) !== 0) {
                $this->addLog("Invalid file path attempted: $fullPath (realpath validation failed)", "error");
                return new ApiResponse(403, array('message' => 'Invalid file path.'));
            }

            // Check if file exists
            if (!file_exists($realPath) || !is_file($realPath)) {
                $this->addLog("File not found: $realPath", "error");
                return new ApiResponse(404, array('message' => 'File not found.'));
            }

            // Get file info
            $fileSize = filesize($realPath);
            $mimeType = mime_content_type($realPath);

            $this->addLog("Serving file: $realPath (size: $fileSize, type: $mimeType)", "info");

            // Determine the filename to send to the client
            $downloadFilename = $requestAnnotation ? basename($realPath) : basename($bundleName);

            // Set appropriate headers for file download
            header('Content-Type: ' . $mimeType);
            header('Content-Length: ' . $fileSize);
            header('Content-Disposition: inline; filename="' . $downloadFilename . '"');
            header('Accept-Ranges: bytes');
            header('Cache-Control: public, max-age=3600');

            // Handle range requests for large files (useful for audio/video streaming)
            if (isset($_SERVER['HTTP_RANGE'])) {
                $range = $_SERVER['HTTP_RANGE'];
                if (preg_match('/bytes=(\d+)-(\d*)/', $range, $rangeMatches)) {
                    $start = intval($rangeMatches[1]);
                    $end = !empty($rangeMatches[2]) ? intval($rangeMatches[2]) : $fileSize - 1;

                    if ($start > $end || $start >= $fileSize) {
                        http_response_code(416);
                        header('Content-Range: bytes */' . $fileSize);
                        $this->addLog("Invalid range request: $range", "error");
                        die('Requested range not satisfiable');
                    }

                    http_response_code(206);
                    header('Content-Range: bytes ' . $start . '-' . $end . '/' . $fileSize);
                    header('Content-Length: ' . ($end - $start + 1));

                    $file = fopen($realPath, 'rb');
                    fseek($file, $start);
                    echo fread($file, $end - $start + 1);
                    fclose($file);
                    exit;
                }
            }

            // Output the file
            readfile($realPath);
            exit;
        } catch (Exception $e) {
            $this->addLog("Exception in getFileDownload: " . $e->getMessage(), "error");
            $this->addLog("Stack trace: " . $e->getTraceAsString(), "error");
            return new ApiResponse(500, array('message' => 'Internal server error: ' . $e->getMessage()));
        }
    }
    
    function getMongoDb() {
        $mongoPass = getenv("MONGO_ROOT_PASSWORD");
        $client = new Client("mongodb://root:".$mongoPass."@mongo");
        $database = $client->selectDatabase('visp');
        return $database;
    }

    function userHasProjectAuthorization($projectId) {
        // Check if username is in session
        if(empty($_SESSION['username'])) {
            $this->addLog("No username in session", "error");
            return false;
        }
    
        $this->addLog("Checking authorization for projectId: $projectId (type: ".gettype($projectId)."), username: ".$_SESSION['username'], "debug");
        
        // Get the project from MongoDB
        $database = $this->getMongoDb();
        $collection = $database->selectCollection('projects');
        
        // Try to find project - log what we're searching for
        $this->addLog("Searching for project with id: '$projectId'", "debug");
        $project = $collection->findOne(['id' => $projectId]);
        
        // Convert MongoDB document to array
        $projectData = json_decode(json_encode(iterator_to_array($project)), TRUE);
        $this->addLog("Found project: ".print_r(['id' => $projectData['id'] ?? 'no-id', 'members' => count($projectData['members'] ?? [])], true), "debug");
        
        // Check if user is in project members
        $foundUser = false;
        if(!empty($projectData['members'])) {
            $memberUsernames = [];
            foreach($projectData['members'] as $member) {
                $memberUsernames[] = $member['username'] ?? 'no-username';
                if(isset($member['username']) && $member['username'] == $_SESSION['username']) {
                    $foundUser = true;
                    break;
                }
            }
            $this->addLog("Project members: ".print_r($memberUsernames, true), "debug");
        } else {
            $this->addLog("Project has no members array", "debug");
        }
        
        if(!$foundUser) {
            $this->addLog("User ".$_SESSION['username']." attempted to access unauthorized project: $projectId", "warn");
        } else {
            $this->addLog("Authorization check passed for user ".$_SESSION['username']." on project $projectId", "debug");
        }
        
        return $foundUser;
    }

    function handleUpload() {
        $this->addLog("handleUpload", "debug");

        // Check if a file was uploaded
        if (!isset($_FILES['fileData'])) {
            $this->addLog("No file uploaded.", "error");
            return new ApiResponse(400, "No file uploaded.");
        }

        // Check for file upload errors
        $error = $_FILES['fileData']['error'];
        if ($error !== UPLOAD_ERR_OK) {
            switch ($error) {
                case UPLOAD_ERR_INI_SIZE:
                    $message = "File exceeds the maximum upload size allowed by the server.";
                    break;
                case UPLOAD_ERR_FORM_SIZE:
                    $message = "File exceeds the maximum size specified in the form.";
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $message = "File was only partially uploaded.";
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $message = "No file was uploaded.";
                    break;
                default:
                    $message = "Unknown upload error (Code: $error).";
            }
            $this->addLog($message, "error");
            return new ApiResponse(400, $message);
        }

        // Log file meta data and $_FILES and $_POST if fileMeta is missing
        if(empty($_POST['fileMeta'])) {
            $date = date("Y-m-d H:i:s");
            file_put_contents("/var/log/api/debug/FILES-".$_SESSION['username']."-".$date.".dump", print_r($_FILES, true));
            file_put_contents("/var/log/api/debug/POST-".$_SESSION['username']."-".$date.".dump", print_r($_POST, true));
            $this->addLog("Missing file metadata in POST request.", "error");
            return new ApiResponse(400, "Missing file metadata");
        }
    
        // Decode fileMeta and sanitize inputs
        $fileMeta = json_decode($_POST['fileMeta']);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->addLog("Invalid JSON in fileMeta: " . json_last_error_msg(), "error");
            return new ApiResponse(400, "Invalid JSON in file metadata");
        }
        
        $fileName = $this->sanitize($fileMeta->filename);
        $group = $this->sanitize($fileMeta->group);
        $context = $this->sanitize($fileMeta->context);
    
        $this->addLog("Received upload file with filename '".$fileName."'");
        $this->addLog("Post-sanitization filename: ".$fileName, "debug");
        $this->addLog("Post-sanitization group name: ".$group, "debug");
    
        // Check if the uploaded file is in $_FILES and is valid
        if (!isset($_FILES['fileData']) || $_FILES['fileData']['error'] !== UPLOAD_ERR_OK) {
            $this->addLog("File upload error: " . $_FILES['fileData']['error'], "error");
            return new ApiResponse(400, "File upload failed. Error code: " . $_FILES['fileData']['error']);
        }
    
        $targetDir = "/tmp/uploads/".$_SESSION['username']."/".$context."/".$group;
        $dirOk = $this->createDirectory($targetDir);
        if (!$dirOk || !is_writable($targetDir)) {
            $this->addLog("Upload directory is not writable: ".$targetDir, "error");
            return new ApiResponse(400, "Server could not create upload directory. Check server permissions.");
        }
    
        // Attempt to move the uploaded file and check if it succeeds
        $targetFilePath = $targetDir . "/" . $fileName;
        if (!move_uploaded_file($_FILES['fileData']['tmp_name'], $targetFilePath)) {
            $this->addLog("Failed to move uploaded file to target directory: ".$targetFilePath, "error");
            return new ApiResponse(400, "Failed to move uploaded file to destination.");
        }
    
        // Successfully moved file
        $this->addLog("File successfully moved to: " . $targetFilePath, "info");
    
        // Log file type
        $fileType = $_FILES['fileData']['type'];
        $this->addLog("File Type: " . $fileType, "debug");
    
        // Handle specific file types (e.g., zip)
        if ($fileType === "application/x-zip-compressed" || $fileType === "application/zip") {
            $this->handleZipArchive($fileName, $targetDir);
        }
    
        // Return success response
        return new ApiResponse(200, "File uploaded successfully.");
    }
    
    function rrmdir($dir) { 
        if (is_dir($dir)) { 
          $objects = scandir($dir);
          foreach ($objects as $object) { 
            if ($object != "." && $object != "..") { 
              if (is_dir($dir. DIRECTORY_SEPARATOR .$object) && !is_link($dir."/".$object))
                $this->rrmdir($dir. DIRECTORY_SEPARATOR .$object);
              else
                unlink($dir. DIRECTORY_SEPARATOR .$object); 
            } 
          }
          rmdir($dir); 
        } 
      }

    function handleZipArchive($archiveFile, $targetDir) {
        $this->addLog("File ".$archiveFile." is zipped, unzipping", "debug");
        $zip = new ZipArchive();
        $result = $zip->open($targetDir."/".$archiveFile); //might contain multiple files
        if($result === true) {
            $zip->extractTo($targetDir."/");
            $zip->close();
            
            $dir = array_diff(scandir($targetDir), array('..', '.'));
            $this->addLog("File unzipped to: ".$targetDir."/", "debug");
            $this->addLog("Archive files: ".implode(", ", $dir)."/", "debug");
    
            //delete these suckers
            foreach($dir as $dirItem) {
                if($dirItem == "__MACOSX") {
                    $this->rrmdir($targetDir."/".$dirItem);
                }
            }
            $dir = array_diff($dir, array('__MACOSX'));

            //If the zip archive is actually a zipped directory,
            foreach($dir as $dirItem) {
                if(is_dir($targetDir."/".$dirItem)) {
                    $filesInDir = array_diff(scandir($targetDir."/".$dirItem), array('..', '.'));
                    foreach($filesInDir as $fileInDir) {
                        if(is_dir($targetDir."/".$dirItem."/".$fileInDir)) {
                            $this->rrmdir($targetDir."/".$dirItem."/".$fileInDir);
                            continue;
                        }
                        copy($targetDir."/".$dirItem."/".$fileInDir, $targetDir."/".$fileInDir);
                        unlink($targetDir."/".$dirItem."/".$fileInDir);
                    }
                    rmdir($targetDir."/".$dirItem);
                }
            }
            $destFiles = array_diff(scandir($targetDir), array('..', '.'));

            foreach($destFiles as $dirItem) {
                $mimeType = mime_content_type($targetDir."/".$dirItem);
                if($mimeType != "audio/x-wav") {
                    unlink($targetDir."/".$dirItem);
                    $this->addLog("Deleted non-wav file in upload: File: ".$dirItem." Type: ".$mimeType);
                }
            }
            
            //Delete original zip file
            unlink($targetDir."/".$archiveFile);
        }
        else {
            //Failed
            $this->addLog("Could not open uploaded zip archive!", "error");
            
            switch($result) {
                case ZipArchive::ER_EXISTS;
                    $this->addLog("ZipArchive: File already exists.", "error");
                    break;
                case ZipArchive::ER_INCONS;
                    $this->addLog("ZipArchive: Zip archive inconsistent.", "error");
                    break;
                case ZipArchive::ER_INVAL;
                    $this->addLog("ZipArchive: Invalid argument.", "error");
                    break;
                case ZipArchive::ER_MEMORY;
                    $this->addLog("ZipArchive: Malloc failure.", "error");
                    break;
                case ZipArchive::ER_NOENT;
                    $this->addLog("ZipArchive: No such file.", "error");
                    break;
                case ZipArchive::ER_NOZIP;
                    $this->addLog("ZipArchive: Not a zip archive.", "error");
                    break;
                case ZipArchive::ER_OPEN;
                    $this->addLog("ZipArchive: Can't open file.", "error");
                    break;
                case ZipArchive::ER_READ;
                    $this->addLog("ZipArchive: Read error.", "error");
                    break;
                case ZipArchive::ER_SEEK;
                    $this->addLog("ZipArchive: Seek error.", "error");
                    break;
            }
            
            
        }
    }

    function createDirectory($targetDir) {
        if(!is_dir($targetDir)) {
            // Check parent directory permissions
            $parentDir = dirname($targetDir);
            if (!is_dir($parentDir)) {
                $this->addLog("Parent directory does not exist: ".$parentDir, "debug");
            } elseif (!is_writable($parentDir)) {
                $this->addLog("Parent directory is not writable: ".$parentDir, "error");
                $this->addLog("Parent directory permissions: ".substr(sprintf('%o', fileperms($parentDir)), -4), "error");
            }
            
            $oldUmask = umask(0);
            // Use 0777 to allow any user to create subdirectories (needed when dirs created by root but accessed by www-data)
            $mkdirResult = @mkdir($targetDir, 0777, true);
            umask($oldUmask);
            
            if(!$mkdirResult) {
                $processUser = posix_getpwuid(posix_geteuid());
                $lastError = error_get_last();
                $this->addLog("Failed creating upload destination! : ".$targetDir." As user: ".$processUser['name'], "error");
                if ($lastError) {
                    $this->addLog("mkdir error: ".$lastError['message'], "error");
                }
                // Log parent directory info for debugging
                if (is_dir($parentDir)) {
                    $this->addLog("Parent dir exists: ".$parentDir." with permissions: ".substr(sprintf('%o', fileperms($parentDir)), -4), "debug");
                }
            } else {
                $this->addLog("Successfully created directory: ".$targetDir, "debug");
            }
            return $mkdirResult;
        }
        return true;
    }
    
    function signOut() {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        header("Location: https://".$_SERVER['HTTP_HOST']);
        
        return false;
    }
    
    function addLog($msg, $level = "info") {
        $level = strtolower($level);

        if(is_object($msg)) {
            $msg = serialize($msg);
        }

        if($level == "info" || $level == "error") {
            file_put_contents("/var/log/api/webapi.log", date("Y-m-d H:i:s")." [".strtoupper($level)."] ".$msg."\n", FILE_APPEND);
            file_put_contents("/var/log/api/webapi.debug.log", date("Y-m-d H:i:s")." [".strtoupper($level)."] ".$msg."\n", FILE_APPEND);
        }
        if($level == "debug") {
            file_put_contents("/var/log/api/webapi.debug.log", date("Y-m-d H:i:s")." [".strtoupper($level)."] ".$msg."\n", FILE_APPEND);
        }
    }

    function slugify($inputString) {
        $inputString = strtolower(trim($inputString));
        $replacements = array(
            '@' => '_at_',
            '.' => '_dot_',
            ' ' => '_',
        );
    
        return preg_replace_callback('/[@.\s]/', function ($match) use ($replacements) {
            return $replacements[$match[0]];
        }, $inputString);
    }
    
    function getUserSessionAttributes() {
        $output = [
            'firstName' => $_SESSION['firstName'],
            'lastName' => $_SESSION['lastName'],
            'fullName' => $_SESSION['firstName']." ".$_SESSION['lastName'],
            'email' => $_SESSION['email'],
            'username' => $this->slugify($_SESSION['eppn']),
            'id' => $_SESSION['id'],
            'eppn' => $_SESSION['eppn'],
            'privileges' => $_SESSION['privileges'],
            'loginCount' => isset($_SESSION['loginCount']) ? $_SESSION['loginCount'] : null,
            'lastLoginAt' => isset($_SESSION['lastLoginAt']) ? $_SESSION['lastLoginAt'] : null,
            'previousLoginAt' => isset($_SESSION['previousLoginAt']) ? $_SESSION['previousLoginAt'] : null,
            'lastLoginDurationSeconds' => isset($_SESSION['lastLoginDurationSeconds']) ? $_SESSION['lastLoginDurationSeconds'] : null,
        ];
    
        return new ApiResponse(200, $output);
    }


    /**
     * Function: sanitize
     * 
     * Blatantly stolen from https://stackoverflow.com/questions/2668854/sanitizing-strings-to-make-them-url-and-filename-safe?lq=1
     */
    function sanitize($string, $force_lowercase = false, $anal = false) {
        $strip = array("~", "`", "!", "@", "#", "$", "%", "^", "&", "*", "=", "+", "[", "{", "]",
                       "}", "\\", "|", ";", ":", "\"", "'", "&#8216;", "&#8217;", "&#8220;", "&#8221;", "&#8211;", "&#8212;",
                       "â€”", "â€“", ",", "<", ">", "?", "(", ")");
        $clean = trim(str_replace($strip, "", strip_tags($string)));
        $clean = preg_replace('/\s+/', "_", $clean);
        $clean = ($anal) ? preg_replace("/[^a-zA-Z0-9]/", "", $clean) : $clean ;
        return ($force_lowercase) ?
            (function_exists('mb_strtolower')) ?
                mb_strtolower($clean, 'UTF-8') :
                strtolower($clean) :
            $clean;
    }
}

$app = new Application($domain);
$routerOutput = $app->route();
echo $routerOutput;


?>
