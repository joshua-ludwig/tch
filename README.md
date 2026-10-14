# TC Grün-Weiss Heiligenwald – Website

Statische Seite ohne Build-Schritt. Webdesign und Konzept: Joshua Ludwig.

## Vorschau lokal
```
node serve.js
```
Dann `http://localhost:5190` öffnen. Dieser Server dient nur der Vorschau.

## Hochladen (auf den bestehenden Webspace)
Diese Dateien und Ordner kommen auf den Server:
- `index.html`, `aktuelles.html`, `galerie.html`, `impressum.html`, `datenschutz.html`
- `meldung-u15-landesliga-meister.html`, `meldung-u18-oberkirchen.html`
- `css/`, `js/`
- `assets/fonts`, `assets/vendor`, `assets/logo`, `assets/hero/web`, `assets/img`, `assets/people`, `assets/sponsors`

**Nicht hochladen:** `assets/orig` (Originale, ca. 84 MB), die PNG-Dateien direkt in `assets/hero`, `serve.js`, `PLAN.md`, `TEXTE.md`, `README.md`.

## Testadresse und Livegang
- **Test:** `tch.joshua-wurf.de` als Subdomain in Hostinger anlegen und den Inhalt dieses Repos dort ablegen (Git-Deployment oder Dateimanager). Die `.htaccess` sperrt auf dieser Adresse automatisch Suchmaschinen und KI-Crawler (`X-Robots-Tag` und `robots-test.txt`). Auf der Testadresse muss nichts umgestellt werden.
- **Livegang:** Dieselben Dateien auf die Hauptdomain `tc-heiligenwald.de` legen. Canonical-Links, Sitemap und `llms.txt` zeigen bereits dorthin. Danach in der Google Search Console die Sitemap `https://tc-heiligenwald.de/sitemap.xml` einreichen und das Google Business Profil prüfen.
- **Aufnahmeantrag:** Das PDF liegt in `downloads/`. Die alten Adressen der bisherigen Seite werden per `.htaccess` weitergeleitet.
- **Sicherheit:** HTTPS ist in Hostinger zu aktivieren (kostenlos). Die Content-Security-Policy in der `.htaccess` wurde lokal ohne Verstöße getestet, auf dem Server sollte trotzdem einmal die Browser-Konsole geprüft werden.

## Neue Meldung ergänzen
1. Kopie von `meldung-u18-oberkirchen.html` anlegen und Text, Datum, Foto ändern.
2. In `aktuelles.html` und im Abschnitt „Aktuelles“ der `index.html` eine Karte ergänzen.

## Neue Fotos in der Galerie
Die Alben stehen in `js/gallery-data.js`. Foto als WebP (1600 px breit) in `assets/img`, kleine Version (640 px) in `assets/img/thumb`, dann den Dateinamen ohne Endung in die Liste `photos` des Albums eintragen.

## Technik
- Schriften und Skripte liegen lokal (GSAP, ScrollTrigger, Lenis). Keine Cookies, keine externen Dienste.
- Externe Links öffnen erst nach Klick: Speisekarte (`speisekarte.jetzt`), Google Maps, Aufnahmeantrag (PDF auf der alten Seite), Sponsoren.

## Kontaktformular (PHP)

Das Formular im Footer sendet per POST an `kontakt.php` (Hostinger, `mail()`).
Empfänger und Absender stehen oben in der Datei (`$EMPFAENGER`, `$ABSENDER`).
Lege am besten ein Postfach `kontakt@tc-heiligenwald.de` an und trage es als Absender ein,
sonst landen Mails leichter im Spam. Nach dem Upload einmal eine Testnachricht senden.

## 3D-Schläger neu bauen

Quelle: `src/racket3d.js` (Three.js, komplett im Code gebaut). Das Bundle `js/racket3d.min.js` entsteht mit:

```bash
npm i three esbuild
npx esbuild src/racket3d.js --bundle --minify --format=esm --outfile=js/racket3d.min.js
```
