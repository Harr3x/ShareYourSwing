# ShareYourSwing

Swingolf-Scorecard als Progressive Web App (PWA).

Swingolf ist eine Golf-Variante auf kürzeren Bahnen, oft ohne vollständiges Schläger-Set. Diese App hilft, Runden anzulegen, Scores einzutragen und Statistiken zu verfolgen – offline und installierbar.

## Features

- Runden anlegen und Scores eintragen
- Spieler- und Platzverwaltung
- Statistik-Ansicht
- Offline-fähig (Service Worker)
- Installierbar auf Smartphone & Desktop (PWA)

## Lokal starten

Beliebigen HTTP-Server im Projektverzeichnis verwenden, z. B.:

```sh
python3 -m http.server 8080
# oder
npx serve .
```

Danach `http://localhost:8080` im Browser öffnen.

## Tests

```sh
node --test tests/golf.test.js
```

## Tech Stack

- Vanilla JavaScript (ES Modules)
- IndexedDB (lokale Datenhaltung)
- PWA (Service Worker + Manifest)
- CSS (kein Framework)