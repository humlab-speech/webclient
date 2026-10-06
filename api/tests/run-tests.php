<?php
// Dependency-free runner for the pure session-security helpers:
//   php api/tests/run-tests.php
// Exits 0 when every assertion passes. No composer, no MongoDB, no Apache
// needed — it must stay runnable in any environment that has a php CLI.
// This file must never execute over HTTP.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../sessionSecurity.php';

$failures = 0;
function check(string $name, bool $ok): void
{
    global $failures;
    echo ($ok ? "ok   " : "FAIL ") . $name . "\n";
    if (!$ok) {
        $failures++;
    }
}

// --- cookieParams -----------------------------------------------------------
[$d, $s, $h] = cookieParams(["BASE_DOMAIN" => "visp.local", "HTTP_PROTOCOL" => "http"]);
check("dev mode: domain follows BASE_DOMAIN, not Host", $d === ".visp.local");
check("dev mode: http protocol -> insecure cookie", $s === false);
check("cookie is always HttpOnly", $h === true);

[$d, $s] = cookieParams(["BASE_DOMAIN" => "example.edu", "HTTP_PROTOCOL" => "https"]);
check("prod mode: domain follows BASE_DOMAIN", $d === ".example.edu");
check("prod mode: https -> Secure cookie", $s === true);

// The Host header must have no influence at all — present it with hostile values.
$a = cookieParams(["BASE_DOMAIN" => "", "HTTP_PROTOCOL" => "https", "HTTP_HOST" => "evil.example"]);
$b = cookieParams(["BASE_DOMAIN" => "", "HTTP_PROTOCOL" => "https"]);
check("unset BASE_DOMAIN -> host-only cookie", $a[0] === "");
check("HTTP_HOST never changes any cookie attribute", $a === $b);

// PHP's getenv() yields false when an env var is missing.
[$d, $s] = cookieParams(["BASE_DOMAIN" => false, "HTTP_PROTOCOL" => false]);
check("missing env: no domain leak, Secure default", $d === "" && $s === true);

// Explicit vector table for the exact contract src/index.php (the SPA shell
// that mints the domain-wide PHPSESSID, now via cookieParams) relies on:
// BASE_DOMAIN set -> ".domain"; empty -> ""; HTTP_PROTOCOL=http -> secure=false;
// unset -> true; httpOnly always true.
$cookieVectors = [
    ["BASE_DOMAIN" => "visp.example.edu"],
    ["BASE_DOMAIN" => "visp.example.edu", "HTTP_PROTOCOL" => "http"],
    ["BASE_DOMAIN" => ""],
    ["BASE_DOMAIN" => "", "HTTP_PROTOCOL" => "https"],
    ["HTTP_PROTOCOL" => "http"],
    ["HTTP_PROTOCOL" => "https"],
];
foreach ($cookieVectors as $i => $v) {
    [$vd, $vs, $vh] = cookieParams($v);
    $base = array_key_exists('BASE_DOMAIN', $v) ? trim((string) $v['BASE_DOMAIN']) : "";
    $proto = array_key_exists('HTTP_PROTOCOL', $v) ? strtolower(trim((string) $v['HTTP_PROTOCOL'])) : "https";
    $wantDomain = $base !== "" ? "." . $base : "";
    $wantSecure = $proto !== "http";
    check("cookieParams vector #$i domain matches BASE_DOMAIN", $vd === $wantDomain);
    check("cookieParams vector #$i secure follows HTTP_PROTOCOL", $vs === $wantSecure);
    check("cookieParams vector #$i httpOnly always true", $vh === true);
}


// --- sessionValidationPayload ----------------------------------------------
check("empty session serializes to [] (the contract session-manager parses)", sessionValidationPayload([]) === "[]");

$doc = [
    '_id' => 'MongoId("64e71bdb16e4d351def68ca5")',
    'id' => 'p-user',
    'firstName' => 'Test',
    'lastName' => 'User',
    'email' => 'testuser@example.com',
    'username' => 'testuser_at_example_dot_com',
    'personalAccessToken' => 'glpat-SECRETVALUE',
    'phpSessionId' => 'abc123',
    'eppn' => 'testuser@example.com',
    'loginAllowed' => true,
    'system_role' => 'user',
];
$json = sessionValidationPayload($doc);
check("real session yields a JSON object", str_starts_with($json, "{"));
foreach (['personalAccessToken', 'phpSessionId', '_id'] as $leaky) {
    check("payload never contains $leaky", str_contains($json, $leaky) === false);
}
$payload = json_decode($json, true);
check("username survives (session-manager checks it)", ($payload['username'] ?? null) === $doc['username']);
check("eppn survives (the Mongo refetch key)", ($payload['eppn'] ?? null) === $doc['eppn']);
check("loginAllowed survives (authorization state)", ($payload['loginAllowed'] ?? null) === true);

// A session that cannot identify anyone (no username, no eppn) must keep the
// "[]" signal, even if some other session keys were set.
check("session without identity -> []", sessionValidationPayload(['loginCount' => 3]) === "[]");


// --- requestOriginOk --------------------------------------------------------
$BASE = "visp.example.edu";
$ok = function (array $server) use ($BASE) { return requestOriginOk($server, $BASE); };

check("cross-origin POST refused", $ok(["HTTP_ORIGIN" => "https://evil.example", "HTTP_HOST" => "visp.example.edu"]) === false);
check("same-origin POST allowed", $ok(["HTTP_ORIGIN" => "https://visp.example.edu", "HTTP_HOST" => "visp.example.edu"]) === true);
check("subdomain (artic/recorder) POST allowed", $ok(["HTTP_ORIGIN" => "https://artic.visp.example.edu", "HTTP_HOST" => "visp.example.edu"]) === true);
check("lookalike suffix refused", $ok(["HTTP_ORIGIN" => "https://visp.example.edu.attacker.test", "HTTP_HOST" => "visp.example.edu"]) === false);
check("missing Origin + cross-site Sec-Fetch-Site refused", $ok(["HTTP_HOST" => "visp.example.edu", "HTTP_SEC_FETCH_SITE" => "cross-site"]) === false);
check("missing Origin + same-origin Sec-Fetch-Site allowed", $ok(["HTTP_HOST" => "visp.example.edu", "HTTP_SEC_FETCH_SITE" => "same-origin"]) === true);
check("missing Origin + none (address bar / non-fetch) allowed", $ok(["HTTP_HOST" => "visp.example.edu", "HTTP_SEC_FETCH_SITE" => "none"]) === true);
check("missing both headers (legacy UA) allowed", $ok(["HTTP_HOST" => "visp.example.edu"]) === true);
check("dev: Host without BASE_DOMAIN matches Host", $ok(["HTTP_ORIGIN" => "http://localhost:8081", "HTTP_HOST" => "localhost:8081", "HTTP_SEC_FETCH_SITE" => "same-origin"]) === true);

// The empty session-manager validation call must keep working: it is a GET,
// sent without Origin/Sec-Fetch-Site headers over the docker network - the
// dispatch gate exempts GET, and even if reached, no-Origin-without-SFS is ok.
check("session-manager style call (no headers) still passes", $ok(["HTTP_HOST" => "apache"]) === true);

// --- result -----------------------------------------------------------------

// --- result -----------------------------------------------------------------
echo $failures === 0 ? "\nALL TESTS PASSED\n" : "\n$failures FAILURE(S)\n\n";
exit($failures === 0 ? 0 : 1);
