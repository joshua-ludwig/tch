<?php
/**
 * Kontaktformular des TC Grün-Weiss Heiligenwald.
 * Verschickt Name, E-Mail, Telefon (freiwillig) und Nachricht per E-Mail an den Verein.
 * Es wird nichts in einer Datenbank gespeichert. Für den Spamschutz liegt nur kurz ein
 * Hashwert der IP-Adresse mit Zeitstempeln in einer Temp-Datei (Löschung nach 1 Stunde).
 * Läuft ab PHP 7.4.
 */

// ---- Einstellungen ----
$EMPFAENGER   = 'tc-heiligenwald@t-online.de';
$ABSENDER     = '';          // leer = kontakt@<Domain der Seite>. Besser: ein echtes Postfach der Domain eintragen.
$MAX_PRO_STUNDE = 5;         // erlaubte Anfragen pro IP-Adresse und Stunde
$MIN_SEKUNDEN = 3;           // so schnell kann kein Mensch das Formular ausfüllen

header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

$wantsJson = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

function antwort($ok, $text, $status = 200)
{
    global $wantsJson;
    http_response_code($status);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => $ok, 'message' => $text), JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        $t = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           . '<title>Kontakt | TC Grün-Weiss Heiligenwald</title>'
           . '<body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#0f4d2a">'
           . '<h1>' . ($ok ? 'Danke!' : 'Das hat nicht geklappt') . '</h1><p>' . $t . '</p>'
           . '<p><a href="/" style="color:#0f4d2a">Zur Startseite</a></p></body></html>';
    }
    exit;
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    antwort(false, 'Bitte benutze das Formular auf der Seite.', 405);
}

// ---- Spamschutz 1: unsichtbares Feld, das nur Roboter ausfüllen ----
if (isset($_POST['website']) && trim((string) $_POST['website']) !== '') {
    antwort(true, 'Danke für deine Nachricht.');   // Roboter bekommen eine Scheinbestätigung
}

// ---- Spamschutz 2: Zeit seit dem Laden der Seite (vom Browser mitgeschickt) ----
$t = isset($_POST['t']) ? (int) $_POST['t'] : 0;
if ($t > 0) {
    $alter = (time() * 1000 - $t) / 1000;
    if ($alter < $MIN_SEKUNDEN) {
        antwort(false, 'Das ging zu schnell. Bitte versuche es in ein paar Sekunden noch einmal.', 429);
    }
}

// ---- Eingaben prüfen ----
$name    = isset($_POST['name']) ? trim((string) $_POST['name']) : '';
$email   = isset($_POST['email']) ? trim((string) $_POST['email']) : '';
$phone   = isset($_POST['phone']) ? trim((string) $_POST['phone']) : '';
$message = isset($_POST['message']) ? trim((string) $_POST['message']) : '';

if ($name === '' || $email === '' || $message === '') {
    antwort(false, 'Bitte fülle Name, E-Mail und Nachricht aus.', 422);
}
if (!isset($_POST['privacy'])) {
    antwort(false, 'Bitte bestätige die Kenntnisnahme der Datenschutzerklärung.', 422);
}
if (mb_strlen($name, 'UTF-8') > 100 || mb_strlen($email, 'UTF-8') > 150 || mb_strlen($message, 'UTF-8') > 3000) {
    antwort(false, 'Eine Eingabe ist zu lang.', 422);
}
if ($phone !== '' && !preg_match('/^[0-9+()\/ -]{6,25}$/', $phone)) {
    antwort(false, 'Bitte gib die Telefonnummer nur mit Ziffern an, zum Beispiel 06821 68787.', 422);
}
if (preg_match('/[<>0-9]/', $name) || mb_strlen($name, 'UTF-8') < 2) {
    antwort(false, 'Bitte gib deinen Namen ohne Ziffern und Sonderzeichen an.', 422);
}
if (preg_match('/[\r\n]/', $name) || preg_match('/[\r\n]/', $email) || !filter_var($email, FILTER_VALIDATE_EMAIL) || strpos(substr($email, strrpos($email, '@')), '.') === false) {
    antwort(false, 'Bitte gib eine gültige E-Mail-Adresse und einen Namen ohne Zeilenumbruch an.', 422);
}
// Viele Links in der Nachricht deuten auf Spam hin
if (preg_match_all('#https?://#i', $message) > 2) {
    antwort(false, 'Bitte schicke nicht mehr als zwei Links.', 422);
}

// ---- Spamschutz 3: Anfragen pro IP-Adresse begrenzen ----
$ip   = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
$tmp  = sys_get_temp_dir();
$jetzt = time();
foreach ((array) glob($tmp . '/tch_rl_*') as $alt) {          // Dateien älter als 1 Stunde löschen
    if (is_file($alt) && $jetzt - filemtime($alt) > 3600) {
        @unlink($alt);
    }
}
$datei = $tmp . '/tch_rl_' . hash('sha256', $ip . '|tch-heiligenwald');
$zeiten = array();
if (is_file($datei)) {
    $zeiten = array_filter(array_map('intval', explode(',', (string) @file_get_contents($datei))), function ($z) use ($jetzt) {
        return $jetzt - $z < 3600;
    });
}
if (count($zeiten) >= $MAX_PRO_STUNDE) {
    antwort(false, 'Es kamen gerade sehr viele Anfragen von deiner Adresse. Bitte versuche es später noch einmal.', 429);
}
$zeiten[] = $jetzt;
@file_put_contents($datei, implode(',', $zeiten), LOCK_EX);

// ---- E-Mail zusammenbauen ----
$host = isset($_SERVER['SERVER_NAME']) ? preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['SERVER_NAME']) : 'localhost';
$host = preg_replace('/^www\./i', '', $host);
$von  = $ABSENDER !== '' ? $ABSENDER : 'kontakt@' . $host;

$betreff = 'Kontaktanfrage über die Website von ' . mb_substr($name, 0, 60, 'UTF-8');
$betreffKodiert = mb_encode_mimeheader($betreff, 'UTF-8', 'B', "\r\n");
$text = "Name: " . $name . "\r\n"
      . "E-Mail: " . $email . "\r\n"
      . ($phone !== '' ? "Telefon: " . $phone . "\r\n" : '')
      . "\r\n"
      . "Nachricht:\r\n" . $message . "\r\n\r\n"
      . "--\r\nGesendet über das Kontaktformular auf " . $host . "\r\n";

$kopf = 'From: ' . mb_encode_mimeheader('Website TC Heiligenwald', 'UTF-8', 'B') . ' <' . $von . ">\r\n"
      . 'Reply-To: ' . $email . "\r\n"
      . "MIME-Version: 1.0\r\n"
      . "Content-Type: text/plain; charset=UTF-8\r\n"
      . "Content-Transfer-Encoding: 8bit\r\n"
      . "X-Mailer: kontakt.php\r\n";

$gesendet = @mail($EMPFAENGER, $betreffKodiert, $text, $kopf, '-f' . $von);

if ($gesendet) {
    antwort(true, 'Danke für deine Nachricht. Wir melden uns so schnell wie möglich bei dir.');
}
antwort(false, 'Die Nachricht konnte gerade nicht verschickt werden. Schreib uns bitte direkt an tc-heiligenwald@t-online.de.', 500);
