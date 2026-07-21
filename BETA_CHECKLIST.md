# 🚀 Beta-Test — Checkliste & Anleitung

Selbstständige Anleitung, um **Runners Conquer** in einen Beta-Test zu bringen
(Web/PWA sofort · iOS via TestFlight). Reihenfolge von oben nach unten abarbeiten.

---

## 0) 🔴 PRE-FLIGHT — Blocker (VOR jedem Beta erledigen)

- [ ] **RLS-Sicherheitslücke schließen.** Supabase-Advisor meldete
      `rls_disabled_in_public` (eine Tabelle ohne Row-Level-Security = öffentlich
      les-/schreibbar). Betroffene Tabelle(n) finden:
      ```sql
      select schemaname, tablename
      from pg_tables
      where schemaname = 'public' and rowsecurity = false
      order by tablename;
      ```
      Dann RLS **plus passende Policies** setzen (nicht nur RLS an — sonst ist die
      Tabelle für die App gesperrt). Fix pro Tabelle anfragen.
- [ ] **Alle SQL-Migrationen auf der Produktions-DB.** `setup_migration.sql`
      bündelt alles Nötige (Rivalen, Privatsphäre, Profil-Läufe, Heimatkern,
      Klub-Beschreibung). Einmal gegen Prod ausführen (idempotent).
      Verifikation, dass keine RLS-Lücke bleibt:
      ```sql
      select count(*) from pg_tables where schemaname='public' and rowsecurity=false;
      -- muss 0 sein
      ```
- [ ] **Edge Functions live.** `conquer` + `bot_tick` werden per CI beim Push auf
      `main` automatisch deployt (`SUPABASE_ACCESS_TOKEN` gesetzt). Prüfen, dass der
      letzte Deploy grün war.
- [ ] **Ende-zu-Ende-Testlauf** auf einem echten Gerät:
      Registrieren → GPS „Immer" erlauben → Lauf starten → über freie Hexagone
      laufen → **Gebiet erscheint** → App neu starten → **Gebiet noch da** →
      Punkte/XP stimmen. (Deckt auf, ob Backend produktiv wirklich greift.)

---

## 1) ⚡ Schnellster Beta-Weg: Web / PWA (heute möglich)

`main` deployt automatisch auf Vercel — kein Apple-Account, keine Review.

1. Vercel-Produktions-URL an Tester geben.
2. Tester öffnen sie in **Safari (iOS)** / **Chrome (Android)** → **„Zum
   Home-Bildschirm hinzufügen"** → startet wie eine App (inkl. GPS im Vordergrund).
3. Hinweis an Tester: Standort erlauben; PWA-Hintergrund-GPS ist eingeschränkter
   als die native App — für Vordergrund-Läufe aber voll nutzbar.

> Ideal für den ersten Freundeskreis-Test, um Backend + Spielfluss zu prüfen.

---

## 2) 🍎 iOS TestFlight (native App)

**Voraussetzungen (einmalig):**
- Apple Developer Program (99 $/Jahr).
- App-Eintrag in **App Store Connect**, Bundle-ID **`com.runconquer.app`**.
- In Xcode unter *Signing & Capabilities* dein **Team** ausgewählt (Automatic
  Signing), Capability **Background Modes → Location updates** ist aktiv.

**Build hochladen (bei jeder neuen Version):**
```bash
# im Projektordner!
git pull
npm install                 # nur beim ersten Mal / nach Dep-Änderungen
npm run sync:ios            # baut www/ neu + kopiert in die iOS-App (Pflicht!)
grep APP_VERSION ios/App/App/public/index.html   # Kontrolle: aktueller Web-Stand
npm run open:ios            # öffnet App.xcworkspace
```
Dann in **Xcode**:
1. Oben Ziel **„Any iOS Device (arm64)"** wählen.
2. **Product → Archive**.
3. Im Organizer: **Distribute App → App Store Connect → Upload**.
4. **Build-Nummer** (`CURRENT_PROJECT_VERSION`) muss bei jedem Upload **höher**
   sein als der letzte. Marketing-Version steht auf **1.0.0**.

**TestFlight einrichten (App Store Connect → TestFlight):**
- Interne Tester (bis 100, dein Team): sofort verfügbar, keine Review.
- Externe Tester (bis 10 000): brauchen eine kurze **Beta-App-Review** + die
  Angaben unten (Beta-Beschreibung, „What to Test", Kontakt).
- **Export-Compliance:** Nutzt die App nur Standard-HTTPS-Verschlüsselung → i. d. R.
  „Nein" bei „proprietäre Verschlüsselung".

> Gotcha (wichtig): Nach `npm run sync:ios` in Xcode **die App vom Gerät löschen**
> und neu **Run/Install**, sonst serviert der Service-Worker-Cache die alte Seite.

---

## 3) 📦 Alternative: AltStore (Sideload, ohne Review)

Das Repo pflegt `altstore-source.json` (+ Auto-Bumps). Für technische Tester ohne
TestFlight: AltStore-Quelle abonnieren, App sideloaden (7-Tage-Signatur, muss
regelmäßig erneuert werden). Kein Apple-Review, aber umständlicher für Laien.

---

## 4) 📝 Tester-Infos (Vorlage — für TestFlight „Test Details" & an Web-Tester)

**Was ist das?**
Runners Conquer — beim Laufen eroberst du echte Stadt-Hexagone und verteidigst dein
Revier gegen andere & Bots. Fraktionen, Klubs, Season-Pass.

**Was testen?**
- Registrieren + Standort „Immer" erlauben.
- Einen echten Lauf (≥ 500 m) starten/stoppen → wird ein Gebiet erobert?
- Karte: eigenes/feindliches Gebiet antippen (Infoleiste, Besitzer → Profil).
- Profil: Klub antippen (Beschreibung/Mitglieder), Follower-Liste, Lauf antippen
  (Hexagon-Popup), Gebietsfarbe/Theme wechseln.
- Season-Pass-Belohnung abholen; Heimatkern setzen; Boost aktivieren.
- Kommt alles zurück nach App-Neustart?

**Bekannte Punkte / in Arbeit**
- Natives Hintergrund-GPS wird noch feldgetestet (Batterie/Genauigkeit).
- Push-Benachrichtigungen für Angriffe: in Planung.

**Feedback bitte an:** _<Support-Mail / Kanal hier eintragen>_ — oder in der App
über **Einstellungen → Support**.

---

## 5) Nach dem Beta

- Feedback sammeln, Crash-/Fehlerberichte prüfen (App-Logs im Admin).
- Balancing beobachten (Verfall, Punkte, Bot-Aggressivität).
- Ideen-Backlog: siehe **IDEEN.md** für die nächsten Motivations-Features.
