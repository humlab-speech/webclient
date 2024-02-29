<?php

require 'api/vendor/autoload.php';
use MongoDB\Client;

$domain = ($_SERVER['HTTP_HOST'] != 'localhost') ? $_SERVER['HTTP_HOST'] : false;

session_set_cookie_params(60*60*8, "/", $domain);
session_start();
$sid = session_id();
$_SESSION['projectName'] = getenv("PROJECT_NAME");

function formatEppn($eppn) {
  $eppn = preg_replace("/@/", "_at_", $eppn);
  $eppn = preg_replace("/\./", "_dot_", $eppn);
  return $eppn;
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

$shibHeadersFound = false;
$attributePrefix = "";
if(!empty($_SERVER['REDIRECT_Shib-Session-ID'])) {
    $shibHeadersFound = true;
    $attributePrefix = "REDIRECT_";
}
else if(!empty($_SERVER['Shib-Session-ID'])) {
    $shibHeadersFound = true;
    $attributePrefix = "";
}

if($shibHeadersFound) {
    $_SESSION['shibSessionId'] = $_SERVER[$attributePrefix.'Shib-Session-ID'];
    $_SESSION['shibSessionExpires'] = $_SERVER[$attributePrefix.'Shib-Session-Expires'];
    $_SESSION['shibSessionInactivity'] = $_SERVER[$attributePrefix.'Shib-Session-Inactivity'];
    $_SESSION['shibIdentityProvider'] = $_SERVER[$attributePrefix.'Shib-Identity-Provider'];

    $_SESSION['firstName'] = $_SERVER[$attributePrefix.'givenName'];
    $_SESSION['lastName'] = $_SERVER[$attributePrefix.'sn'];
    $_SESSION['eppn'] = $_SERVER[$attributePrefix.'eppn'];
    $_SESSION['username'] = formatEppn($_SESSION['eppn']);
    $_SESSION['fullName'] = $_SESSION['firstName']." ".$_SESSION['lastName'];

    if(!empty($_SERVER[$attributePrefix.'email'])) {
        $_SESSION['email'] = $_SERVER[$attributePrefix.'email'];
    }
    else {
        $_SESSION['email'] = $_SERVER[$attributePrefix.'mail'];
    }

    $_SESSION['authorized'] = true;

    //addLog(print_r($_SESSION, true), "debug");
}

//addLog("get: ".$_GET['login'], "debug");
//addLog("env: ".getenv("TEST_USER_LOGIN_KEY"), "debug");

if(!empty(getenv("TEST_USER_LOGIN_KEY")) && $_GET['login'] == getenv("TEST_USER_LOGIN_KEY")) {
  if($_GET['user'] == "test2") {
    addLog("Starting session for testuser2@example.com", "info");
    $_SESSION['firstName'] = "Test2";
    $_SESSION['lastName'] = "User2";
    $_SESSION['fullName'] = "Test2 User2";
    $_SESSION['email'] = "testuser2@example.com";
    $_SESSION['eppn'] = "testuser2@example.com";
    $_SESSION['username'] = formatEppn($_SESSION['eppn']);
    $_SESSION['authorized'] = true;
    $_SESSION['testUser'] = true;
  }
  else if($_GET['user'] == "test3") {
    addLog("Starting session for testuser3@example.com", "info");
    $_SESSION['firstName'] = "Test3";
    $_SESSION['lastName'] = "User3";
    $_SESSION['fullName'] = "Test3 User3";
    $_SESSION['email'] = "testuser3@example.com";
    $_SESSION['eppn'] = "testuser3@example.com";
    $_SESSION['username'] = formatEppn($_SESSION['eppn']);
    $_SESSION['authorized'] = true;
    $_SESSION['testUser'] = true;
  }
  else if($_GET['user'] == "test4") {
    addLog("Starting session for testuser4@example.com", "info");
    $_SESSION['firstName'] = "Test4";
    $_SESSION['lastName'] = "User4";
    $_SESSION['fullName'] = "Test4 User4";
    $_SESSION['email'] = "testuser4@example.com";
    $_SESSION['eppn'] = "testuser4@example.com";
    $_SESSION['username'] = formatEppn($_SESSION['eppn']);
    $_SESSION['authorized'] = true;
    $_SESSION['testUser'] = true;
  }
  else {
    addLog("Starting session for testuser@example.com", "info");
    $_SESSION['firstName'] = "Test";
    $_SESSION['lastName'] = "User";
    $_SESSION['fullName'] = "Test User";
    $_SESSION['email'] = "testuser@example.com";
    $_SESSION['eppn'] = "testuser@example.com";
    $_SESSION['username'] = formatEppn($_SESSION['eppn']);
    $_SESSION['authorized'] = true;
    $_SESSION['testUser'] = true;
  }
}
else {
  addLog("Not starting session for any testuser", "info");
}

addLog("Started session ".$sid."", "info");

if(!empty($_SESSION['username']) && empty($_SESSION['id'])) {
  addLog("Looking up user ".$_SESSION['username']." in database", "info");
  $mongoPass = getenv("MONGO_ROOT_PASSWORD");
  $client = new Client("mongodb://root:".$mongoPass."@mongo");
  $database = $client->selectDatabase('visp');
  $collection = $database->selectCollection('users');
  $cursor = $collection->findOne(['username' => $_SESSION['username']]);
  if($cursor == null) { //empty result / not found
    if($_SESSION['testUser']) {
      //create the mongodb entry
      $collection->insertOne([
        'firstName' => $_SESSION['firstName'],
        'lastName' => $_SESSION['lastName'],
        'fullName' => $_SESSION['fullName'],
        'email' => $_SESSION['email'],
        'eppn' => $_SESSION['eppn'],
        'username' => $_SESSION['username'],
        'phpSessionId' => $sid,
        'authorized' => true,
        'loginAllowed' => true
      ]);
    }
    else {
      //if the user does not exist in the mongodb, we add it, but do not authorize it
      //addLog("User ".$_SESSION['username']." not found in database", "error");
      //create the mongodb entry
      $collection->insertOne([
        'firstName' => $_SESSION['firstName'],
        'lastName' => $_SESSION['lastName'],
        'fullName' => $_SESSION['fullName'],
        'email' => $_SESSION['email'],
        'eppn' => $_SESSION['eppn'],
        'username' => $_SESSION['username'],
        'phpSessionId' => $sid,
        'authorized' => false,
        'loginAllowed' => false
      ]);
    }
  }
  else {
    //update the mongodb user object with the current phpsessid
    $collection->updateOne(
      ['username' => $_SESSION['username']],
      ['$set' => ['phpSessionId' => $sid]]
    );

    $user = json_decode(json_encode(iterator_to_array($cursor)), TRUE); //this is so dumb... but it works
    $_SESSION['id'] = $user['id'];
  }
}

//addLog(print_r($_SESSION, true), "debug");

//include("./index.html");
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title id="title">Visible Speech</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <link rel="stylesheet" href="../node_modules/font-awesome/scss/font-awesome.scss">
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
</head>
<body>
  <app-root></app-root>
</body>
</html>
