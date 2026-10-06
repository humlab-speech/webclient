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

// --- result -----------------------------------------------------------------
echo $failures === 0 ? "\nALL TESTS PASSED\n" : "\n$failures FAILURE(S)\n";
exit($failures === 0 ? 0 : 1);
?>
