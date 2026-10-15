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


// --- vispShellJson (src/index.php's window.visp block) ----------------------
// The shell used to raw-echo session values (Shibboleth attributes, login
// query params) into a JS string context. Now the whole object is built by
// this helper: values must survive the round-trip byte-identical, and no
// character may appear that could close the string or the <script> tag.
$hostile = [
    'projectName' => false, // getenv() miss - the old raw echo rendered ""
    'eppn' => 'testuser@example.com',
    'username' => 'testuser_at_example_dot_com',
    'fullName' => 'Evil"; alert(1); var x="</script><script>alert(2)</script>',
    'email' => "a'b&c\"d",
    'shibSessionExpires' => "1758780000", // header-supplied, must stay a quoted string
    'loginAllowed' => true,
    'system_role' => 'sys_admin',
    'loginCount' => "7",
];
$json = vispShellJson($hostile, 'sess42');
$shell = json_decode($json, true);
check("visp shell: value quoting/closing the script tag round-trips intact", $shell['fullName'] === $hostile['fullName']);
check("visp shell: value with quotes and ampersand round-trips intact", $shell['email'] === "a'b&c\"d");
check("visp shell: no raw < > & ' in the emitted JSON", preg_match('#[<>&\']#', $json) === 0);
check("visp shell: loginAllowed stays a real boolean", ($shell['loginAllowed'] ?? null) === true);
check("visp shell: system_role stays a string", ($shell['system_role'] ?? null) === 'sys_admin');
check("visp shell: loginCount numeric string becomes int", ($shell['loginCount'] ?? null) === 7 && is_int($shell['loginCount']));
check("visp shell: absent lastLoginDurationSeconds stays null", array_key_exists('lastLoginDurationSeconds', $shell) && $shell['lastLoginDurationSeconds'] === null);
check("visp shell: phpSessionId carries the sid", ($shell['phpSessionId'] ?? null) === 'sess42');
check("visp shell: getenv() miss renders empty string", ($shell['projectName'] ?? 'x') === "");
check("visp shell: header-supplied shib value stays a string", ($shell['shibSessionExpires'] ?? null) === "1758780000" && is_string($shell['shibSessionExpires']));
$anon = json_decode(vispShellJson([], 'sid0'), true);
check("visp shell: anonymous session keeps every field", is_array($anon) && count($anon) === 16);
check("visp shell: anonymous eppn key present and empty (SPA checks 'eppn' in visp)", array_key_exists('eppn', $anon) && $anon['eppn'] === "");
check("visp shell: anonymous loginAllowed false, both counts null", $anon['loginAllowed'] === false && $anon['loginCount'] === null && $anon['lastLoginDurationSeconds'] === null);


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

// --- dead code stays dead ---------------------------------------------------
// Application::httpRequest() was deleted in 91bb119 (2026-04-23). php -l cannot
// see a call to a method that does not exist and no test reached these routes,
// so five of them returned a fatal 500 for six months with a green lint and a
// green build. These three asserts are the only thing that catches that class
// of bug: a reintroduced call fails here instead of in a user's browser.
$apiDir = dirname(__DIR__);
$callers = [];
foreach (glob("$apiDir/*.php") ?: [] as $f) {
    if (strpos((string)file_get_contents($f), 'httpRequest(') !== false) {
        $callers[] = basename($f);
    }
}
check("nothing calls the removed Application::httpRequest()", $callers === []);
check("SessionManagerInterface.class.php stays deleted", !file_exists("$apiDir/SessionManagerInterface.class.php"));
check("the session please/save/close routes stay deleted", strpos(file_get_contents("$apiDir/api.php"), '/session/please') === false
    && strpos(file_get_contents("$apiDir/api.php"), '/api/v1/session/save') === false);
// The extraction loop moved into extractZipEntries() (sessionSecurity.php) so the
// harness can run the real one. A leftover call to the class methods it replaced
// is a fatal 500 that php -l cannot see — the httpRequest() class of bug above.
$staleCalls = array_values(array_filter(['ensureUploadDir', 'removeExtractedUploads'], function ($m) use ($apiDir) {
    return strpos((string) file_get_contents("$apiDir/api.php"), $m . '(') !== false;
}));
check("api.php calls neither extraction method that moved to sessionSecurity.php", $staleCalls === []);


// --- zipWithinLimits --------------------------------------------------------
// The bounds behind zipEntriesAreSafe(): entry count and uncompressed size.
$KB = 1024; $MB = 1024 * 1024; $GB = 1024 * 1024 * 1024;
check("a project folder of takes is accepted", zipWithinLimits(400, 600 * $MB, 300 * $MB) === true);
check("entry cap accepts 5000", zipWithinLimits(5000, 10 * $MB, 5 * $MB) === true);
check("entry cap refuses 5001", zipWithinLimits(5001, 10 * $MB, 5 * $MB) === false);
check("1 MB archive claiming 600 MB is refused", zipWithinLimits(50, 600 * $MB, $MB) === false);
check("claim below the 500 MB ratio floor is accepted", zipWithinLimits(50, 400 * $MB, $MB) === true);
check("3 GB claimed from a 1 GB archive is refused despite a 3:1 ratio", zipWithinLimits(500, 3 * $GB, $GB) === false);
check("an explicit ceiling overrides the default", zipWithinLimits(500, 3 * $GB, $GB, 4 * $GB) === true);
putenv("ZIP_MAX_UNCOMPRESSED_BYTES=" . (4 * $GB));
check("ZIP_MAX_UNCOMPRESSED_BYTES raises the ceiling", zipWithinLimits(500, 3 * $GB, $GB) === true);
putenv("ZIP_MAX_UNCOMPRESSED_BYTES");
check("more than the default ceiling is refused, whatever the ratio", zipWithinLimits(5000, 12 * $GB, 10 * $GB) === false);

// --- zipEntryVerdict: entry names, incl. macOS Finder archives (A1) ---------
// Rules that used to live inline in api.php's zipEntriesAreSafe(), where no test
// could reach them (the zip extension is not part of the Apache image's test
// environment). The traversal rule must stay as strict as it was.
check("an ordinary entry is extracted", zipEntryVerdict('take1.wav') === 'ok');
check("one directory level is legitimate", zipEntryVerdict('my_takes/take1.wav') === 'ok');
check("an embedded .. in a file name stays valid", zipEntryVerdict('my..take.wav') === 'ok');
check("traversal is refused", zipEntryVerdict('../take1.wav') === 'unsafe');
check("traversal deeper in the path is refused", zipEntryVerdict('a/../../etc/passwd') === 'unsafe');
check("an absolute entry name is refused", zipEntryVerdict('/etc/passwd') === 'unsafe');
check("a backslash is refused", zipEntryVerdict('a\..\x.wav') === 'unsafe');
check("a NUL is refused", zipEntryVerdict("a\0b.wav") === 'unsafe');
check("an empty entry name is refused", zipEntryVerdict('') === 'unsafe');
check("a dot-file no one could name again is refused", zipEntryVerdict('.hidden.wav') === 'unusable');
check("an oversized entry name is refused", zipEntryVerdict(str_repeat('a', 256) . '.wav') === 'unusable');
// A Finder-compressed folder carries these alongside the real files. Refusing the
// archive for them (the old behaviour) locked every macOS user out of uploading.
check("an AppleDouble entry is skipped, not refused", zipEntryVerdict('__MACOSX/._take1.wav') === 'junk');
check("an AppleDouble entry next to the takes is skipped", zipEntryVerdict('._take1.wav') === 'junk');
check(".DS_Store is skipped", zipEntryVerdict('my_takes/.DS_Store') === 'junk');
check("the __MACOSX directory entry is skipped", zipEntryVerdict('__MACOSX/') === 'junk');
check("traversal is still traversal inside __MACOSX", zipEntryVerdict('__MACOSX/../../etc/passwd') === 'unsafe');

// --- zipArchiveVerdict: the gate, with the entries read lazily --------------
$gate = function (array $names, array $sizes = []) use ($MB) {
    $size = count($sizes) ? $sizes : array_fill(0, count($names), 1024);
    return zipArchiveVerdict(
        count($names),
        function ($i) use ($names) { return $names[$i]; },
        function ($i) use ($size) { return $size[$i]; },
        10 * $MB
    );
};
check("a Finder zip is accepted", $gate(['take1.wav', '__MACOSX/._take1.wav']) === null);
check("the gate refuses traversal", $gate(['take1.wav', '../../etc/passwd']) !== null);
check("the gate refuses an unusable name", $gate(['.take1.wav']) !== null);
check("the gate accepts a normal folder of takes", $gate(['my_takes/', 'my_takes/take1.wav', 'my_takes/take2.wav']) === null);
check("the gate still refuses a 200:1 declared size", $gate(array_fill(0, 50, 'take.wav'), array_fill(0, 50, 12 * $MB)) !== null);
check("junk entries do not count toward the declared size", $gate(
    ['take1.wav', '__MACOSX/._take1.wav'],
    [1024, 10 * $GB]
) === null);

// A3: the bound exists to bound the walk over the entries. The raw name count
// from the end-of-central-directory settles the outer bound with no reads at all
// (the 200000-entry case above); the 5000-entry cap itself can only be counted
// per entry, because junk does not spend it — so the check is that the walk
// stops the moment the cap is passed, not after reading the whole archive.
$reads = 0;
$many = 5001;
$refused = zipArchiveVerdict(
    $many,
    function ($i) use (&$reads) { $reads++; return "take$i.wav"; },
    function ($i) { return 1024; },
    10 * $MB
);
check("a 5001-entry archive is refused", $refused !== null);
check("the walk stops as soon as the cap is passed", $reads === 5001);
$reads = 0;
check("a 5000-entry archive is accepted and does read its entries", zipArchiveVerdict(
    5000,
    function ($i) use (&$reads) { $reads++; return "take$i.wav"; },
    function ($i) { return 1024; },
    10 * $MB
) === null && $reads === 5000);
check("zipEntryCountOk is the same cap", zipEntryCountOk(5000) === true && zipEntryCountOk(5001) === false);

// --- the cap counts entries that land on disk, not names in the archive ----
// 'junk' is never written, so it must not spend the cap: a folder of 5001
// entries zipped in Finder is half AppleDouble and has to get through.
$finder = [];
for ($i = 0; $i < 5001; $i++) {
    $finder[] = $i % 2 ? "__MACOSX/._take$i.wav" : "take$i.wav";
}
check(
    "junk entries do not count against the entry cap (5001 names, 2500 takes)",
    zipArchiveVerdict(
        count($finder),
        function ($i) use ($finder) { return $finder[$i]; },
        function ($i) { return 1024; },
        10 * $MB
    ) === null
);
// Junk is free to add, so the raw name count needs its own cheap bound: the
// one that still stops a bomb before a single getNameIndex() round trip.
$reads = 0;
$boom = zipArchiveVerdict(
    200000,
    function ($i) use (&$reads) { $reads++; return "take$i.wav"; },
    function ($i) { return 1024; },
    10 * $MB
);
check("a 200k-entry archive is refused", $boom !== null);
check("the outer bound needs 0 entry reads", $reads === 0);
check(
    "the entry cap still refuses 5001 real takes",
    zipArchiveVerdict(5001, function ($i) { return "take$i.wav"; }, function ($i) { return 1024; }, 10 * $MB) !== null
);

// --- nothing usable in the archive is a refusal, not a 200 ------------------
// Every junk entry is skipped, so an archive of pure Apple metadata extracts to
// an empty directory and handleUpload() answers 200 "File uploaded successfully"
// while session-manager later logs "Upload directory does not exist".
check(
    "an archive of nothing but Apple metadata is refused",
    $gate(['__MACOSX/._take1.wav', '._take1.wav', 'my_takes/.DS_Store', 'my_takes/']) !== null
);
check(
    "an archive whose only entries are directories is refused",
    $gate(['my_takes/', 'my_takes/sub/']) !== null
);
check(
    "one real take among the junk is accepted",
    $gate(['my_takes/take1.wav', '__MACOSX/._take1.wav', 'my_takes/.DS_Store']) === null
);

// --- zipByteCeiling: the same size rules, expressed as a budget -------------
// The extractor spends this while writing (streamCopyWithinLimit); the declared
// sizes are only the early refusal, because they are attacker-supplied.
check("ceiling of a 1 MB archive is the 500 MB floor", zipByteCeiling(1 * $MB) === 500 * $MB);
check("ceiling of a 300 MB archive is the 2 GB absolute cap", zipByteCeiling(300 * $MB) === 2 * $GB);
check("ceiling of a 1 GB archive is the 2 GB absolute cap", zipByteCeiling(1 * $GB) === 2 * $GB);
check("an explicit ceiling caps it", zipByteCeiling(1 * $GB, 3 * $GB) === 3 * $GB);
putenv("ZIP_MAX_UNCOMPRESSED_BYTES=" . (4 * $GB));
check("ZIP_MAX_UNCOMPRESSED_BYTES raises the ceiling too", zipByteCeiling(1 * $GB) === 4 * $GB);
putenv("ZIP_MAX_UNCOMPRESSED_BYTES");
// The ceiling and the yes/no must never disagree, whatever the archive size.
$agree = true;
foreach ([0, 1, 1024, $MB, 26 * $MB, 25 * $MB, 300 * $MB, 5 * $GB, 10 * $GB] as $a) {
    foreach ([0, 1, 500 * $MB, 501 * $MB, 2 * $GB, 2 * $GB + 1, 12 * $GB] as $d) {
        $agree = $agree && (zipWithinLimits(10, $d, $a) === ($d <= zipByteCeiling($a)));
    }
}
check("zipWithinLimits and zipByteCeiling accept exactly the same sizes", $agree);

// --- streamCopyWithinLimit: the ceiling bound the WRITE (A4) ---------------
$workDir = sys_get_temp_dir() . "/visp-api-tests";
@mkdir($workDir, 0777, true);
$src = "$workDir/src.wav";
file_put_contents($src, random_bytes(3 * $MB));
$dst = "$workDir/dst.wav";
$sourceBytes = filesize($src);
$over = streamCopyWithinLimit(fopen($src, 'r'), $dst, 1 * $MB);
check("an over-cap copy reports more than the ceiling", $over > 1 * $MB);
check("an over-cap copy leaves no partial file behind", !file_exists($dst));
check("an over-cap copy wrote at most one chunk past the ceiling", $over <= 1 * $MB + 65536);
$under = streamCopyWithinLimit(fopen($src, 'r'), $dst, 4 * $MB);
check("an under-cap copy reports the whole entry", $under === $sourceBytes);
check("an under-cap copy lands complete", is_file($dst) && filesize($dst) === $sourceBytes);
check("an under-cap copy is byte-identical", md5_file($dst) === md5_file($src));
file_put_contents("$workDir/empty.wav", "");
$zero = streamCopyWithinLimit(fopen("$workDir/empty.wav", 'r'), "$workDir/empty-out.wav", 1024);
check("an empty entry copies as zero bytes", $zero === 0 && filesize("$workDir/empty-out.wav") === 0);

// --- a legal 255-byte entry name vs the extractor's ".part" suffix ---------
// NAME_MAX is 255 bytes per component and uploadFileName()/zipEntryVerdict()
// allow 255 characters, but the extractor writes a temp name first. Appending
// ".part" to the full name is 260 bytes: fopen() fails with ENAMETOOLONG,
// streamCopyWithinLimit() reports -1 and api.php blames the disk. zipPartPath()
// shortens the name instead of losing the archive.
$longName = str_repeat('t', 251) . '.wav';                 // 255 bytes exactly
$longPath = "$workDir/$longName";
check("a 255-byte entry name is a name the API accepts", zipEntryVerdict($longName) === 'ok');
check("an ordinary entry is still written to \"<name>.part\"", zipPartPath("$workDir/take1.wav") === "$workDir/take1.wav.part");
check("the extractor's temp name for a 255-byte entry stays within NAME_MAX", strlen(basename(zipPartPath($longPath))) <= 255);
check(
    "and such an entry can be copied at all",
    streamCopyWithinLimit(fopen($src, 'r'), zipPartPath($longPath), 4 * $MB) === $sourceBytes
);
@unlink(zipPartPath($longPath));

// --- extractionCleanupPlan: only what this run created (A5) ----------------
$up = "$workDir/uploads";
@mkdir("$up/takename1", 0777, true);
$earlier = "$up/take1.wav";                              // the user's own earlier take
file_put_contents($earlier, "EARLIER TAKE");
$newFile = "$up/takename1/new1.wav";
file_put_contents($newFile, "new");
$plan = extractionCleanupPlan(
    [$earlier, $newFile],                                // one path per entry name
    [$earlier => true, $newFile => false],                // what existed before this run
    ["$up/takename1", "$up/takename1"]                    // created parents, as recorded
);
check("a pre-existing upload is never unlinked", !in_array($earlier, $plan['files'], true));
check("the file this run wrote is unlinked", in_array($newFile, $plan['files'], true));
check("a created parent is reclaimed", in_array("$up/takename1", $plan['dirs'], true));
check("created dirs are listed once", count(array_keys($plan['dirs'], "$up/takename1", true)) === 1);
$plan2 = extractionCleanupPlan([], [], ["$up/a/b", "$up/a", $up]);
check("created dirs are reclaimed deepest first", $plan2['dirs'] === ["$up/a/b", "$up/a", $up]);
check("a directory nobody created is not on the removal list", !in_array("$up/takename1", $plan2['dirs'], true));

// A duplicate-name archive: pre-existence has to be asked ONCE per path, before
// any rename of this run, which is what zipRecordPreExisting() memoizes. Asking
// is_file() per entry (the old "$existedBefore[$path] = is_file($path)") let the
// first entry's own rename count as pre-existence, so cleanup spared — after
// reporting the archive as refused — a file this run itself had written.
$dup = "$up/dup.wav";
@unlink($dup);
$seen = [];
zipRecordPreExisting($seen, $dup);                // entry 1, before its rename
file_put_contents($dup, 'written by this run');   // entry 1's rename landed
check("a name the run itself just wrote is not called pre-existing", zipRecordPreExisting($seen, $dup) === false);
$dupPlan = extractionCleanupPlan([$dup, $dup], $seen, []);
check("a file this run wrote under a duplicate name is still reclaimed", in_array($dup, $dupPlan['files'], true));
@unlink($dup);

// The extraction loop itself, with production as the only implementation:
// extractZipEntries() takes closures over an archive, and api.php hands it
// closures over a ZipArchive. The archive below blows the byte budget on its
// second entry, so what the first entry wrote has to be rolled back.
$extractFrom = function (array $entries, array $sources, string $targetDir, $ceiling) {
    // $entries: list of [name, declared size]; $sources: name => file, or null
    // for an entry that cannot be read at all.
    $log = [];
    $result = extractZipEntries(
        count($entries),
        function ($i) use ($entries) { return $entries[$i][0]; },
        function ($name) use ($sources) {
            return isset($sources[$name]) && $sources[$name] !== null ? fopen($sources[$name], 'r') : false;
        },
        function ($i) use ($entries) { return $entries[$i][1]; },
        $targetDir,
        $ceiling,
        function ($message, $level = "debug") use (&$log) { $log[] = "$level $message"; }
    );
    return [$result, $log];
};
@mkdir("$workDir/s5", 0777, true);
$stored = "$workDir/s5/take1.wav";
file_put_contents($stored, "EARLIER TAKE");
file_put_contents("$workDir/small.wav", str_repeat('a', 100 * 1024));
file_put_contents("$workDir/big.wav", random_bytes(4 * $MB));
[$res, $log] = $extractFrom(
    [['take1.wav', 100 * 1024], ['takename1/new1.wav', 4 * $MB]],   // same name as the stored take
    ['take1.wav' => "$workDir/small.wav", 'takename1/new1.wav' => "$workDir/big.wav"],
    "$workDir/s5",
    1 * $MB                                                         // pretend: a 1 MB archive budget
);
check("an archive that blows the byte budget is refused", $res['ok'] === false);
check("the refusal names the entry that blew it", count($log) === 1 && str_contains($log[0], 'byte ceiling'));
check("an aborted extraction does not truncate a stored take", is_file($stored));
check("an aborted extraction removes the file it added", !file_exists("$workDir/s5/takename1/new1.wav"));
check("an aborted extraction removes no .part file", glob("$workDir/s5/*.part") === []);
check("an aborted extraction leaves no empty directory behind", !is_dir("$workDir/s5/takename1"));

// Nothing of the user's in the way, and a name used twice: the whole run goes.
@mkdir("$workDir/s7", 0777, true);
[$res2] = $extractFrom(
    [['dup.wav', 100 * 1024], ['dup.wav', 100 * 1024], ['broken.wav', 1024]],
    ['dup.wav' => "$workDir/small.wav", 'broken.wav' => null],
    "$workDir/s7",
    10 * $MB
);
check("an archive that names one entry twice leaves nothing behind when it fails", $res2['ok'] === false && glob("$workDir/s7/*") === []);

// An accepted run: junk is skipped on the way in, the folder an entry brings is
// made, and a 255-byte name lands under its own name, not a truncated one.
@mkdir("$workDir/s8", 0777, true);
[$res3] = $extractFrom(
    [
        ['my_takes/', 0],
        ['my_takes/take1.wav', 100 * 1024],
        ['__MACOSX/._take1.wav', 100 * 1024],
        [str_repeat('t', 251) . '.wav', 100 * 1024],
    ],
    [
        'my_takes/' => null,
        'my_takes/take1.wav' => "$workDir/small.wav",
        '__MACOSX/._take1.wav' => "$workDir/small.wav",
        str_repeat('t', 251) . '.wav' => "$workDir/small.wav",
    ],
    "$workDir/s8",
    10 * $MB
);
check("an accepted archive reports success", $res3['ok'] === true && $res3['reason'] === "");
check("a 255-byte entry name lands whole", is_file("$workDir/s8/$longName") && filesize("$workDir/s8/$longName") === filesize("$workDir/small.wav"));
check("an entry inside a folder the archive brings lands too", is_file("$workDir/s8/my_takes/take1.wav"));
check("junk entries never reach the disk", !file_exists("$workDir/s8/__MACOSX"));
check("a successful run leaves no .part file", glob("$workDir/s8/*.part") === []);

// Leave no scratch files behind - the harness runs on a developer's /tmp.
$leftovers = array_merge(glob("$workDir/*") ?: [], glob("$workDir/*/*") ?: [], glob("$workDir/*/*/*") ?: []);
foreach ($leftovers as $p) {
    if (is_file($p)) { unlink($p); }
}
foreach (["$workDir/s5/takename1", "$workDir/s5", "$workDir/s7", "$workDir/s8/my_takes", "$workDir/s8",
          "$workDir/uploads/takename1", "$workDir/uploads", $workDir] as $d) {
    @rmdir($d);
}
check("the harness cleaned up its scratch directory", !is_dir($workDir));

// --- result -----------------------------------------------------------------

// --- result -----------------------------------------------------------------
echo $failures === 0 ? "\nALL TESTS PASSED\n" : "\n$failures FAILURE(S)\n\n";
exit($failures === 0 ? 0 : 1);
