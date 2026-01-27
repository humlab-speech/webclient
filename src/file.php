<?php
/**
 * File Download Handler
 * Handles GET requests at /file/xxx and serves files from the repositories directory
 * Requires a valid PHP session with loginAllowed set to true
 */

require __DIR__ . '/../vendor/autoload.php';
use MongoDB\Client;

// Set session cookie parameters (same as index.php)
$domain = ($_SERVER['HTTP_HOST'] != 'visp.local') ? $_SERVER['HTTP_HOST'] : ".visp.local";
$secure = ($_SERVER['HTTP_HOST'] != 'visp.local') ? true : false;
$httpOnly = false;

session_set_cookie_params(60*60*2, "/", $domain, $secure, $httpOnly);
session_start();

// Check if user has a valid session
if (empty($_SESSION['username'])) {
    http_response_code(401);
    die('Unauthorized: No valid session found');
}

// Check loginAllowed in MongoDB
$mongoPass = getenv("MONGO_ROOT_PASSWORD");
$client = new Client("mongodb://root:".$mongoPass."@mongo");
$database = $client->selectDatabase('visp');
$collection = $database->selectCollection('users');
$user = $collection->findOne(['username' => $_SESSION['username']]);

if ($user == null || !isset($user['loginAllowed']) || $user['loginAllowed'] !== true) {
    http_response_code(403);
    die('Forbidden: User does not have permission to download files');
}

// Get the request URI
$requestUri = $_SERVER['REQUEST_URI'];
$parsedUrl = parse_url($requestUri);
$path = $parsedUrl['path'];

// Extract the file path after /file/
if (preg_match('#^/file/(.+)$#', $path, $matches)) {
    $filePath = $matches[1];
    
    // Construct the full file path
    // Expected format: repositories/{projectId}/Data/VISP_emuDB/{session}/{bundle}/{filename}
    $fullPath = __DIR__ . '/repositories/' . $filePath;
    
    // Security: Prevent directory traversal attacks
    $realPath = realpath($fullPath);
    $baseDir = realpath(__DIR__ . '/repositories');
    
    if ($realPath === false || strpos($realPath, $baseDir) !== 0) {
        http_response_code(403);
        die('Forbidden: Invalid file path');
    }
    
    // Check if file exists
    if (!file_exists($realPath) || !is_file($realPath)) {
        http_response_code(404);
        die('File not found');
    }
    
    // Get file info
    $filename = basename($realPath);
    $fileSize = filesize($realPath);
    $mimeType = mime_content_type($realPath);
    
    // Set appropriate headers for file download
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . $fileSize);
    header('Content-Disposition: inline; filename="' . $filename . '"');
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
    
} else {
    http_response_code(400);
    die('Bad Request: Invalid URL format. Expected /file/{path}');
}
