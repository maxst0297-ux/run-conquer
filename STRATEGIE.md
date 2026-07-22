# Runners Conquer — Go-to-Market & Anti-Cheat

Kurzfazit der Wettbewerbslage: RC gewinnt **nicht** frontal gegen Strava/Nike/Garmin,
sondern als **Nischen-Champion** für kompetitiven, lokalen Revierkampf. Der Erfolg
entscheidet sich an zwei Dingen — **lokaler Dichte** und **Cheat-Sicherheit** —
nicht an Features. Dieses Dokument bricht beide in konkrete Schritte herunter.

---

## Teil A — Seed-Plan für die erste Stadt

**Prinzip:** 10.000 Nutzer in *einer* Stadt schlagen 100.000 weltweit verstreut.
Ein Revierspiel auf leerer Karte macht keinen Spaß → Dichte zuerst, Skalierung später.

### 0. Stadt wählen (Kriterien)
- Kompakte, lauffreundliche Innenstadt (kurze Wege = viele überlappende Reviere).
- Vorhandene Lauf-Community (Vereine, Parkrun, Lauftreffs, Uni-Sport).
- Deine eigene Präsenz/Netzwerk vor Ort (Seed-Nutzer musst du persönlich aktivieren).
- Empfehlung: **eine** mittelgroße Stadt oder **ein** dichtes Viertel einer Großstadt.

### 1. Vor dem Launch (Woche -4 bis 0)
- **Ziel-Viertel abstecken:** 2–4 km² Kerngebiet definieren, in dem garantiert Gegner sind.
- **50–100 Seed-Läufer** persönlich gewinnen (Lauftreffs, Vereine, Fitnessstudios).
  Diese Kohorte MUSS am Launch-Tag laufen — sonst leere Karte.
- **2–3 Gründungs-Klubs** vorab anlegen lassen (Verein A vs. Verein B vs. Uni) →
  sofort Klub-Krieg-Narrativ.
- **Fraktions-Aufteilung** thematisch an die Stadt binden (z. B. Stadtteile/Kieze).

### 2. Launch-Woche (Woche 1)
- **Kick-off-Lauf-Event**: gemeinsamer Termin, an dem alle Seed-Nutzer gleichzeitig
  ihr Startrevier erobern. Erzeugt sofort eine „lebendige" Karte + Wettbewerb.
- **Wöchentliche Reset-/Saison-Mechanik** kommunizieren: „Wer hält das Viertel bis Sonntag?"
- Lokale Kanäle: Uni-Gruppen, Lauf-Discords/WhatsApp, lokale Sport-Insta-Accounts.

### 3. Retention-Motor (laufend)
- **Klub-Kriege** sind der wichtigste Wachstumshebel: Gruppen ziehen Mitglieder *mit*
  und lösen das Dichteproblem teilweise selbst (jeder rekrutiert für seinen Klub).
- **Wöchentlicher „Kiez-König"**: sichtbarer lokaler Titel, der Rivalität befeuert.
- **Anstoß-Benachrichtigungen** (sobald nativ): „Dein Revier wird angegriffen!" →
  reaktivierender Push mit echtem Spielgrund.
- **Leere Randgebiete abfedern:** Bot-Gegner nur als Startfüllung, transparent
  markiert; echtes Ziel bleibt PvP.

### 4. Erst skalieren, wenn …
- … das Kern-Viertel selbsttragend ist (tägliche PvP-Kämpfe ohne dein Zutun).
- Dann **Stadt für Stadt** mit demselben Seed-Playbook — nicht global „aufdrehen".

### Metriken, die zählen (nicht Downloads)
- **D7/D30-Retention** in der Seed-Stadt.
- **PvP-Rate**: Anteil Läufe, die ein fremdes Gebiet berühren (Kern-Fun-Indikator).
- **Gebiets-Umschlag/Woche**: Wechseln Reviere den Besitzer? (Totes Spiel = keine Wechsel.)
- **Klub-Aktivität**: aktive Mitglieder pro Klub.

---

## Teil B — Anti-Cheat, priorisiert

Für ein *PvP*-Spiel ist Cheat-Sicherheit existenziell: GPS-Spoofing ist trivial,
und schon wenige Cheater vertreiben genau die kompetitiven Nutzer, die du willst.

### Was heute schon existiert (Server, `conquer` / `_shared/h3-engine`)
- **Speed-Hardcap:** Pace `> 25 km/h` → Lauf ungültig (`speed_hardcap`).
- **Teleport-Erkennung:** `validateTrack` prüft Segment-Geschwindigkeiten der Route.
- **Kadenz-Plausibilität:** wenn `cadence` mitgeschickt und `0` bei Pace `> 6 km/h`
  → `cadence_zero` (ungültig).
- Punkte/XP werden **serverautoritativ** vergeben.

### Die Lücke
`cadence` ist **optional** — ist sie `null`, wird die Prüfung übersprungen. Der Client
sendet aktuell keine echten Pedometer-/HealthKit-Schrittdaten. Ein GPS-Spoofer ohne
Bewegung fällt damit **nicht** durch die Kadenz-Prüfung. Das ist der wichtigste offene Punkt.

### Priorisierte Schritte

**P0 — Native Schrittkadenz erzwingen (größter Hebel)**
- iOS `CMPedometer` / Android Step Counter auslesen, **Ø Schritte/Min** je Lauf an
  `conquer.cadence` senden.
- Serverregel verschärfen: Bei erobernden Läufen (PvP) `cadence` **verpflichtend** und
  im plausiblen Fenster (~140–200 SPM beim Laufen). Fehlt sie oder passt sie nicht zur
  GPS-Distanz → Lauf zählt für Bewegung, aber **nicht** für Eroberungen.
- Kosten: nativer Capacitor-Plugin-Aufruf + kleine Serverregel. **Hoher Schutz, moderater Aufwand.**

**P1 — Track-Plausibilität serverseitig härten**
- Route (Polyline) mitschicken und serverseitig prüfen: Distanz aus Track ≈ gemeldete
  Distanz; keine unrealistischen Sprünge, keine „perfekten" Geraden über Gebäude.
- Schritte↔Distanz-Konsistenz: gemeldete Schritte müssen zur Distanz/Schrittlänge passen.
- **Wohnort-Schutz beachten:** Rohroute nur zur Validierung serverseitig, nie öffentlich
  (Prinzip existiert bereits bei den öffentlichen Läufen).

**P2 — Konto-/Rate-Limits & Ausreißer**
- Max. wertbare Eroberungs-km pro Tag/Konto; Cooldowns.
- Statistische Ausreißer-Erkennung (Tempo/Distanz weit über persönlicher Historie) →
  Soft-Flag zur Review, nicht harter Bann.
- Mehrfachkonten pro Gerät begrenzen.

**P3 — Geräte-Attestation (später, gegen ernsthafte Angreifer)**
- iOS App Attest / Android Play Integrity: bestätigt echte App auf echtem Gerät →
  erschwert Emulatoren/Mock-Location-Farmen. Höherer Aufwand, erst bei Skalierung nötig.

### Leitplanke
- **Bewegung ≠ Eroberung trennen:** Im Zweifel darf ein Lauf für km/Statistik zählen,
  aber **nur** sauber verifizierte Läufe erobern/verteidigen Gebiete. So bestraft man
  Falsch-Positive (schlechtes GPS) nicht zu hart und schützt trotzdem die PvP-Integrität.
- **Soft-Flag vor Hard-Ban:** Verdächtiges markieren und dämpfen statt sofort sperren —
  vermeidet Frust bei ehrlichen Nutzern mit schlechtem Empfang.

---

## Empfohlene Reihenfolge (konkret)
1. **P0 Kadenz nativ** umsetzen (Capacitor-Pedometer-Plugin → `cadence` → Serverregel).
2. Parallel **Seed-Stadt wählen** und 50–100 Seed-Läufer + 2–3 Klubs organisieren.
3. **P1 Track-Plausibilität** vor dem öffentlichen Launch.
4. Launch-Event → Dichte im Kern-Viertel aufbauen.
5. P2/P3 mit wachsender Nutzerzahl nachziehen.
