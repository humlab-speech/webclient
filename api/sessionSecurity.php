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
 *  - httpOnly: shields the PHPSESSID cookie from JavaScript on every
 *    OTHER origin/subdomain - notably app.*, which serves iframe content -
 *    so script injected there cannot read it. It does not hide the session
 *    id from same-origin script: index.php deliberately exposes it as
 *    window.visp.phpSessionId (user.service.ts reads it there), so
 *    same-origin XSS can still see the id. That residual is known and
 *    documented, not fixed here. (The old client-side PHPSESSID peek from
 *    document.cookie was a liveness pre-check that the cookie value could
 *    never actually prove; the getSession round-trip is the real check.)
 */
function cookieParams(array $env): array
{
    $baseDomain = isset($env['BASE_DOMAIN']) ? trim((string) $env['BASE_DOMAIN']) : "";
    $domain = $baseDomain !== "" ? "." . $baseDomain : "";
    $protocol = isset($env['HTTP_PROTOCOL']) ? strtolower(trim((string) $env['HTTP_PROTOCOL'])) : "https";
    return [$domain, $protocol !== "http", true];
}

/**
 * The window.visp object for src/index.php's <script> block, as JSON.
 *
 * The template used to echo the session values raw into a JS string
 * context, so a value that closed the quote or the script tag - coming
 * over a Shibboleth attribute (givenName, sn, eppn, ...) or the login
 * query - broke the shell or ran as script. json_encode with
 * JSON_HEX_TAG|AMP|APOS|QUOT forces every < > & ' " into \u escapes, so
 * no value can close the string or the surrounding tag; the decoded
 * values are identical.
 *
 * The field set and types are the contract the SPA reads (user.service
 * bootstraps eppn/loginAllowed/phpSessionId, the whole object is also
 * sent as authenticateUser data): the 12 identity fields stay quoted
 * strings (absent -> "", matching the old template's empty echo, and a
 * false from getenv() stringifies to ""), loginAllowed stays a real
 * bool, system_role stays a string, loginCount and
 * lastLoginDurationSeconds stay int|null.
 */
function vispShellJson(array $session, string $sid): string
{
    $str = function (string $key) use ($session): string {
        return isset($session[$key]) ? (string) $session[$key] : "";
    };
    $visp = [
        'projectName' => $str('projectName'),
        'username' => $str('username'),
        'eppn' => $str('eppn'),
        'firstName' => $str('firstName'),
        'lastName' => $str('lastName'),
        'fullName' => $str('fullName'),
        'email' => $str('email'),
        'phpSessionId' => $sid,
        'shibSessionId' => $str('shibSessionId'),
        'shibSessionExpires' => $str('shibSessionExpires'),
        'shibSessionInactivity' => $str('shibSessionInactivity'),
        'shibIdentityProvider' => $str('shibIdentityProvider'),
        'loginAllowed' => isset($session['loginAllowed']) ? (bool) $session['loginAllowed'] : false,
        'system_role' => isset($session['system_role']) ? $session['system_role'] : 'user',
        'loginCount' => isset($session['loginCount']) ? (int) $session['loginCount'] : null,
        'lastLoginDurationSeconds' => isset($session['lastLoginDurationSeconds']) && is_numeric($session['lastLoginDurationSeconds']) ? (int) $session['lastLoginDurationSeconds'] : null,
    ];
    return json_encode($visp, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
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


/**
 * Whether a NON-idempotent request may be trusted as same-site.
 *
 * The PHP API authenticates by cookie, so a page on another origin could
 * otherwise perform state-changing requests (upload/delete/session commit)
 * with the victim's credentials. Browsers today always attach Origin to
 * cross-origin POSTs (fetch/XHR *and* form posts), so a present-but-wrong
 * Origin is a hard no. Missing Origin is tolerated only when the request is
 * demonstrably not a cross-site browser request: Sec-Fetch-Site of
 * same-origin/none, or - as a legacy-user-agent fallback - no Sec-Fetch-Site
 * at all. The origin may be the base domain itself or any subdomain of it
 * (artic.*, recorder.* post to this API).
 *
 * Pure over $_SERVER/env data so api/tests/run-tests.php covers it.
 */
function requestOriginOk(array $server, string $baseDomain): bool
{
    $ownHosts = [];
    if ($baseDomain !== "") {
        $ownHosts[] = strtolower($baseDomain);
    }
    if (!empty($server['HTTP_HOST'])) {
        $host = parse_url("http://" . $server['HTTP_HOST'], PHP_URL_HOST);
        if (is_string($host)) {
            $ownHosts[] = strtolower($host);
        }
    }

    if (!empty($server['HTTP_ORIGIN'])) {
        $originHost = parse_url($server['HTTP_ORIGIN'], PHP_URL_HOST);
        if (!is_string($originHost)) {
            return false;
        }
        $originHost = strtolower($originHost);
        foreach ($ownHosts as $own) {
            if ($originHost === $own || str_ends_with($originHost, "." . $own)) {
                return true;
            }
        }
        return false;
    }

    $secFetchSite = strtolower((string)($server['HTTP_SEC_FETCH_SITE'] ?? ""));
    if ($secFetchSite !== "") {
        return in_array($secFetchSite, ["same-origin", "none"], true);
    }
    // No Origin and no Sec-Fetch-Site: a user agent predating both.
    return true;
}


// A project's takes are in the hundreds; bomb tools make millions.
const ZIP_MAX_ENTRIES = 5000;

// A raw-name bound far above the real cap, checked on numFiles before a single
// name is read. The cap itself counts only entries that land on disk, so junk
// (AppleDouble, __MACOSX) is free to add names - and a bomb does not announce
// which of its 200000 entries are real. Walking them costs a libzip round trip
// each, which is exactly what this bound exists to avoid.
const ZIP_MAX_ARCHIVED_ENTRIES = 50000;

/**
 * The cap on entries that actually land on disk, on its own. Junk entries are
 * never written, so they do not spend it - see zipArchiveVerdict(), which also
 * enforces ZIP_MAX_ARCHIVED_ENTRIES on the raw name count.
 */
function zipEntryCountOk($entryCount) {
    return $entryCount <= ZIP_MAX_ENTRIES;
}

/**
 * The size rules as a number: the most uncompressed bytes an archive of
 * $archiveBytes may legitimately hold.
 *
 * Content here is audio: WAV deflates to roughly 2:1, and the upload itself is
 * already capped at 10 GB by upload_max_filesize, so a legitimate archive is
 * bounded by its own size. The ratio rule needs BOTH limbs, not either: a 300 MB
 * archive of recordings legitimately unpacks to ~600 MB, so an absolute floor
 * alone would refuse real uploads, while a ratio alone accepts anything small and
 * refuses nothing big.
 *
 * The absolute ceiling is a guess about recordings, not a measurement: 2 GB of
 * WAV is hours of takes. It exists because a ratio alone is not safe with big
 * archives - long silence compresses by a thousand, so a 10 GB archive (the
 * upload limit) could unpack to a hundred times that. Raise it with
 * ZIP_MAX_UNCOMPRESSED_BYTES if a project ever legitimately needs more.
 *
 * Expressed as a ceiling (not a yes/no) because the extractor has to spend it
 * entry by entry *while* writing - see streamCopyWithinLimit().
 */
function zipByteCeiling($archiveBytes, $absoluteMax = null) {
    if($absoluteMax === null) {
        $fromEnv = (int) getenv("ZIP_MAX_UNCOMPRESSED_BYTES");
        $absoluteMax = $fromEnv > 0 ? $fromEnv : 2 * 1024 * 1024 * 1024;
    }
    $ratioMax = 20;
    $ratioFloor = 500 * 1024 * 1024;
    return min($absoluteMax, max($ratioFloor, $archiveBytes * $ratioMax));
}

/**
 * Declared-size and entry-count bounds as pure arithmetic (no zip extension
 * needed to test them). $declaredBytes is what the archive's central directory
 * claims - attacker-supplied, so this is only the early refusal; the extractor
 * enforces the same ceiling on bytes actually written.
 */
function zipWithinLimits($entryCount, $declaredBytes, $archiveBytes, $absoluteMax = null) {
    return zipEntryCountOk($entryCount)
        && $declaredBytes <= zipByteCeiling($archiveBytes, $absoluteMax);
}

/**
 * What to do with one entry name. Entry names inside an uploaded zip are
 * attacker-controlled and extraction writes them relative to the upload
 * directory, so "../x" walks straight out of it - into another user's uploads,
 * or anywhere the container can write. Returns:
 *
 *  'unsafe'    - absolute path, backslash, NUL, or a ".." segment: refuse the
 *                whole archive rather than quietly dropping entries the sender
 *                expects back. Checked first, always: "__MACOSX/../../x" must
 *                never be skipped as metadata.
 *  'junk'      - Apple's resource-fork noise from a Finder-compressed folder
 *                (__MACOSX/**, ._*, .DS_Store). Skip it, do not refuse: a folder
 *                zipped on a Mac is the normal case, and refusing it locks every
 *                macOS user out of uploading takes. These names are the ones the
 *                extractor and the non-wav filter deleted anyway.
 *  'unusable'  - a stored name no one can name again: dot-prefixed or longer than
 *                255, i.e. what uploadFileName() refuses. Without this rule an
 *                archive leaves behind a file the delete endpoint returns 400
 *                for, that recursive-copy skips, and that container-agent then
 *                refuses the whole save for.
 *  'ok'        - extract it.
 *
 * One directory level is legitimate (a zipped folder is flattened by the
 * caller), so only a ".." as a whole segment counts: "my..take.wav" stays valid.
 */
function zipEntryVerdict(string $name): string {
    if($name === "" || $name[0] === "/" || strpbrk($name, "\0\\") !== false) {
        return 'unsafe';
    }
    $segments = preg_split("#[/\\\\]+#", $name);
    foreach($segments as $segment) {
        if($segment === "..") {
            return 'unsafe';
        }
    }
    // The name an entry ends up stored under is the last segment (a zipped folder
    // is flattened); a trailing empty segment is a directory entry ("folder/"),
    // which stores no file.
    $stored = end($segments);
    if($segments[0] === '__MACOSX' || $stored === '.DS_Store'
        || (strlen($stored) > 2 && $stored[0] === '.' && $stored[1] === '_')) {
        return 'junk';
    }
    if($stored !== "" && ($stored[0] === "." || strlen($stored) > 255)) {
        return 'unusable';
    }
    return 'ok';
}

/**
 * Check an archive's entries without touching the filesystem. $nameAt($i) and
 * $sizeAt($i) read entry $i lazily, so the entry-count cap is settled before a
 * single name is fetched. Returns null when the archive may be extracted, else a
 * reason for the log.
 */
function zipArchiveVerdict($entryCount, callable $nameAt, callable $sizeAt, $archiveBytes, $absoluteMax = null) {
    if($entryCount > ZIP_MAX_ARCHIVED_ENTRIES) {
        return $entryCount . " entries in the archive, the bound is " . ZIP_MAX_ARCHIVED_ENTRIES;
    }
    $declaredBytes = 0;
    $usable = 0;
    for($i = 0; $i < $entryCount; $i++) {
        $name = (string) $nameAt($i);
        $verdict = zipEntryVerdict($name);
        if($verdict === 'unsafe' || $verdict === 'unusable') {
            return "unsafe entry name: " . $name;
        }
        if($verdict === 'junk') {
            continue; // never written: no bytes, no share of the entry cap
        }
        $declaredBytes += (int) $sizeAt($i);
        if(substr($name, -1) !== '/') {
            $usable++; // a directory entry brings a folder, not a take
        }
        if(!zipEntryCountOk($usable)) {
            return "more than " . ZIP_MAX_ENTRIES . " extractable entries";
        }
    }
    if($usable === 0) {
        // Extraction would write nothing at all, and handleUpload() would answer
        // 200 "File uploaded successfully" over an empty upload directory - the
        // silent-success class this pipeline already documents as its most
        // common failure. Say no instead.
        return "nothing usable in the archive";
    }
    if(!zipWithinLimits($usable, $declaredBytes, $archiveBytes, $absoluteMax)) {
        return $usable . " entries declaring " . $declaredBytes . " bytes from a " . $archiveBytes . " byte upload";
    }
    return null;
}

/**
 * Copy a stream into $dstPath, refusing to write more than $max bytes.
 *
 * Returns the number of bytes written: more than $max only when it hit the
 * ceiling, -1 on a write failure (disk full). Either way the partial file is
 * deleted before returning, so nothing unusable is left in the upload directory.
 *
 * This exists because ZipArchive::extractTo() writes an entry in full before any
 * size is measurable, and the declared size that gates the early refusal is
 * attacker-supplied: one entry declaring a byte can inflate until the filesystem
 * - the one holding Mongo's dbPath - fills. Counting while copying is the only
 * ceiling that bounds the moment of writing.
 */
function streamCopyWithinLimit($src, string $dstPath, $max): int {
    $dst = @fopen($dstPath, 'w');
    if($dst === false) {
        return -1;
    }
    $written = 0;
    while(!feof($src)) {
        $chunk = fread($src, 65536);
        if($chunk === false || $chunk === "") {
            break; // EOF
        }
        $written += strlen($chunk);
        if($written > $max) {
            fclose($dst);
            @unlink($dstPath);
            return $written;
        }
        if(fwrite($dst, $chunk) !== strlen($chunk)) {
            fclose($dst);
            @unlink($dstPath);
            return -1;
        }
    }
    fclose($dst);
    return $written;
}

/**
 * The name an entry is written under before it is renamed into place.
 *
 * NAME_MAX is 255 BYTES per path component and a 255-character entry name is
 * legal (uploadFileName() and zipEntryVerdict() both allow exactly that), so
 * appending ".part" to the full name fails with ENAMETOOLONG and the whole
 * archive is refused over one long file name. The suffix therefore goes on a
 * truncation. Two names long enough to land on the same truncated temp are
 * sequential here - the first is renamed away before the second opens the temp
 * with 'w' - so no content is lost, only the temp name is shared.
 */
function zipPartPath(string $path): string {
    $suffix = '.part';
    $base = basename($path);
    if(strlen($base) + strlen($suffix) <= 255) {
        return $path . $suffix;
    }
    return dirname($path) . '/' . substr($base, 0, 255 - strlen($suffix)) . $suffix;
}

/**
 * Did $path exist before THIS extraction run? Asked once per path, the first
 * time it comes up: an earlier entry of the same archive may already have been
 * renamed into place, and asking is_file() again would call the file this run
 * itself wrote "pre-existing" - cleanup would then spare it, leaving the bytes
 * of an archive that was reported as refused. Returns the recorded answer.
 */
function zipRecordPreExisting(array &$existedBefore, string $path): bool {
    if(!array_key_exists($path, $existedBefore)) {
        $existedBefore[$path] = is_file($path);
    }
    return $existedBefore[$path];
}

/**
 * Ensure $dir exists, recording in $createdDirs every ancestor that had to be
 * made: extracting one entry does not create its parents, and the archive has
 * to be able to bring its own folders (a zipped folder is the normal case, not
 * an edge one). Recording them is what lets an aborted extraction reclaim the
 * directories it made instead of leaving a skeleton in the upload area.
 */
function zipEnsureDir(string $dir, array &$createdDirs): void {
    for($d = $dir; $d !== "" && $d !== "/" && $d !== "." && !is_dir($d); $d = dirname($d)) {
        $createdDirs[] = $d;
    }
    if(!is_dir($dir)) {
        $oldUmask = umask(0);
        @mkdir($dir, 0777, true);
        umask($oldUmask);
    }
}

/**
 * Extract an archive's entries into $targetDir, within $ceiling bytes.
 *
 * api.php hands in closures over a ZipArchive, api/tests/run-tests.php hands in
 * closures over arrays - one loop, and the one under test is the one that runs
 * in production. $nameAt($i) is the entry name, $streamAt($name) a readable
 * stream or false, $sizeAt($i) the size the central directory declares.
 *
 * Entry by entry, and streamed against a running byte budget, rather than
 * extractTo() for the whole archive: the sizes the gate above reads come from
 * the central directory, and a crafted archive can declare one byte and inflate
 * to a gigabyte. extractTo() writes an entry in full before any size is
 * measurable, so the ceiling is spent while copying instead
 * (streamCopyWithinLimit) and a partial file is deleted rather than left behind
 * - the filesystem here is the one that holds Mongo's dbPath.
 *
 * Each entry lands as zipPartPath() and is renamed only once written whole, so
 * an abort cannot truncate a take this user stored earlier under the same name.
 * A partial extract is reported as a failure rather than as a stored upload, so
 * the sender learns which takes are missing; on failure this removes only what
 * this run made (extractionCleanupPlan) and the caller removes the archive.
 *
 * Returns ['ok' => bool, 'reason' => string].
 */
function extractZipEntries(
    $entryCount,
    callable $nameAt,
    callable $streamAt,
    callable $sizeAt,
    string $targetDir,
    $ceiling,
    ?callable $log = null
): array {
    $log = $log ?: function ($message, $level = "debug") {};
    $extracted = [];
    $existedBefore = [];
    $createdDirs = [];
    $remaining = $ceiling;
    $failed = false;
    $reason = "";
    for($i = 0; $i < $entryCount; $i++) {
        $name = (string) $nameAt($i);
        if(zipEntryVerdict($name) === 'junk') {
            continue; // Apple's resource forks never land on disk at all
        }
        $path = $targetDir."/".$name;
        // Directory entries included: a zipped folder has to be made here,
        // because extracting a single entry does not create its parents.
        zipEnsureDir(dirname($path), $createdDirs);
        $extracted[] = $path;
        zipRecordPreExisting($existedBefore, $path);
        if(substr($name, -1) === "/") {
            continue; // directory entry, stores nothing
        }
        $stream = $streamAt($name);
        if(!is_resource($stream)) {
            // A directory stored without its trailing slash holds nothing, and
            // the files inside it carry their own path (so their parents get
            // made when they are written) - skip such an entry rather than
            // refuse the archive for a writer's quirk. An entry that does hold
            // content and still cannot be read is a broken upload.
            if((int) $sizeAt($i) === 0) {
                continue;
            }
            $failed = true;
            $reason = "could not read the entry ".$name;
            $log("Could not read the entry ".$name." from the uploaded archive", "error");
            break;
        }
        // The same ceiling as the declared sizes, enforced as the bytes land:
        // this is what catches an archive whose central directory understates
        // itself.
        $part = zipPartPath($path);
        $written = streamCopyWithinLimit($stream, $part, $remaining);
        fclose($stream);
        if($written < 0 || $written > $remaining) {
            $failed = true;
            if($written < 0) {
                $reason = "could not write the entry ".$name;
                $log("Could not write the extracted entry ".$name." (out of disk space?)", "error");
            } else {
                $reason = "entry ".$name." passed the ".$ceiling." byte ceiling";
                $log(
                    "Refused zip archive: an entry passed the ".$ceiling." byte ceiling (".
                    $written." bytes written)", "warn");
            }
            break;
        }
        if(!@rename($part, $path)) {
            @unlink($part);
            $failed = true;
            $reason = "could not store the entry ".$name;
            $log("Could not store the extracted entry ".$name, "error");
            break;
        }
        $remaining -= $written;
    }
    if($failed) {
        $plan = extractionCleanupPlan($extracted, $existedBefore, $createdDirs);
        foreach($plan['files'] as $path) {
            if(is_file($path)) {
                unlink($path);
            }
        }
        foreach($plan['dirs'] as $path) {
            if(is_dir($path)) {
                @rmdir($path); // only ever empty; a parallel upload keeps it
            }
        }
    }
    return ['ok' => !$failed, 'reason' => $reason];
}

/**
 * Which paths an aborted extraction may remove.
 *
 * The upload directory also holds this user's earlier uploads - a take they
 * stored under the same name is the realistic victim - so only files that were
 * absent before ($existedBefore[$path] is not set) may be unlinked, and the
 * directories mkdir() had to create ($createdDirs, which is not the same list as
 * the entry names) are reclaimed deepest-first. rmdir only removes an empty
 * directory, so anything a parallel upload put there survives on its own.
 *
 * Residual, not fixed here: an entry that overwrote a pre-existing take before
 * the abort keeps the new content (extractTo() has the same behaviour) - cleanup
 * preserves the path, not the old bytes.
 */
function extractionCleanupPlan(array $extracted, array $existedBefore, array $createdDirs): array {
    $files = [];
    foreach($extracted as $path) {
        if(empty($existedBefore[$path])) {
            $files[] = $path;
        }
    }
    $dirs = array_values(array_unique($createdDirs));
    usort($dirs, function ($a, $b) {
        return [substr_count($b, '/'), $b] <=> [substr_count($a, '/'), $a];
    });
    return ['files' => $files, 'dirs' => $dirs];
}
