<?php
// Pure, dependency-free helpers for session and cookie security.
// Deliberately free of DB/Apache side effects so api/tests/run-tests.php
// (no composer needed) can cover them.

/**
 * Session cookie scope, derived from the deployment environment - never from
 * the client-controlled Host: header, which let a crafted request push our
 * cookie attributes onto an attacker host or force Secure=false.
 *
 * Returns [domain, secure, httpOnly]:
 *  - domain: ".".$BASE_DOMAIN when configured (host-wide over the deployment),
 *    else "" - a host-only cookie, which is always safe.
 *  - secure: tied to HTTP_PROTOCOL, the explicit per-mode flag the quadlets
 *    set (https in prod, http in dev). This is the dev escape hatch: an
 *    environment setting, not a hostname comparison.
 *  - httpOnly: the session id never needs to be readable from JavaScript.
 *    (The old client-side PHPSESSID peek was a liveness pre-check that the
 *    cookie value could never actually prove; the getSession round-trip is
 *    the real check.)
 */
function cookieParams(array $env): array
{
    $baseDomain = isset($env['BASE_DOMAIN']) ? trim((string) $env['BASE_DOMAIN']) : "";
    $domain = $baseDomain !== "" ? "." . $baseDomain : "";
    $protocol = isset($env['HTTP_PROTOCOL']) ? strtolower(trim((string) $env['HTTP_PROTOCOL'])) : "https";
    return [$domain, $protocol !== "http", true];
}

/**
 * The fields the session-manager needs in order to validate a PHP session.
 * It immediately refetches the full user document from MongoDB by eppn, so
 * serving raw $_SESSION only leaked what it never uses: notably
 * personalAccessToken (a long-lived GitLab token) and phpSessionId.
 *
 * An unauthenticated (or identity-less) session must serialize to exactly
 * "[]" - that is the shape session-manager treats as "User not identified".
 */
function sessionValidationPayload(array $session): string
{
    if (empty($session['username']) && empty($session['eppn'])) {
        return json_encode([]);
    }
    $allowed = ['id', 'username', 'eppn', 'firstName', 'lastName', 'email', 'loginAllowed', 'system_role'];
    $payload = [];
    foreach ($allowed as $key) {
        if (array_key_exists($key, $session)) {
            $payload[$key] = $session[$key];
        }
    }
    return json_encode($payload);
}

