<?php
$domain = getenv("HS_DOMAIN_NAME");
session_set_cookie_params(60*60*8, "/", ".".$domain);
session_start();
$_SESSION['projectName'] = getenv("PROJECT_NAME");

function formatEppn($eppn) {
  $eppn = preg_replace("/@/", "_at_", $eppn);
  $eppn = preg_replace("/\./", "_dot_", $eppn);
  return $eppn;
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
}

if(!empty(getenv("TEST_USER_LOGIN_KEY")) && $_GET['login'] == getenv("TEST_USER_LOGIN_KEY")) {
    
    $_SESSION['firstName'] = "Test";
    $_SESSION['lastName'] = "User";
    $_SESSION['fullName'] = "Test User";
    $_SESSION['email'] = "testuser@example.com";
    $_SESSION['eppn'] = "testuser@example.com";
    $_SESSION['username'] = formatEppn($_SESSION['eppn']);
    $_SESSION['authorized'] = true;
}

//include("./index.html");
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title id="title">VISP</title>
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
