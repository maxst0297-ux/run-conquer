# Phase 4 — Anti-Cheat: Cadence-Validierung (nativ)

Ziel (GDS 3.1): GPS-Läufe mit der Schrittfrequenz (Cadence) aus Apple Health /
Google Fit gegenprüfen. Bewegt sich jemand schnell, aber die Cadence ist 0
(Fahrrad/Auto/Spoofing), wird der Lauf ungültig.

## Was bereits fertig & getestet ist
- **Server (Edge Function `conquer`)**: nimmt ein optionales Feld `cadence`
  (Ø Schritte/Min) entgegen und ruft `validateRun()`:
  - `distanceM < 150` → `too_short`
  - Pace `> 25 km/h` → `speed_hardcap`
  - `cadence` vorhanden und `0` bei Pace `> 6 km/h` → `cadence_zero`
  - `cadence` **null** (keine Health-Daten) → wird **nicht** geprüft (GPS-only).
  In Node getestet (40 Engine-Tests grün).
- **Client**: `getRunCadence()` liest die Cadence aus einem nativen Plugin, wenn
  vorhanden, sonst `null` (kein Block im Web/Simulator). Der Wert wird an die
  Edge Function mitgeschickt.

## Was noch nativ eingerichtet werden muss (in Xcode / Android Studio)
Der Client erwartet ein Capacitor-Plugin mit einer Methode `queryCadence()`, das
`{ cadence: <Schritte pro Minute> }` für den letzten Lauf-Zeitraum zurückgibt.
`getRunCadence()` sucht es unter `Capacitor.Plugins.HealthKit` /
`.Health` / `.CapacitorHealthkit`.

### iOS (HealthKit)
1. In Xcode: **Signing & Capabilities → + Capability → HealthKit**.
2. `Info.plist`: `NSHealthShareUsageDescription` = „Zur Fairness prüft Runners
   Conquer deine Schrittfrequenz während des Laufs."
3. Ein HealthKit-Plugin einbinden (z. B. `@perfood/capacitor-healthkit` oder ein
   eigenes) und `queryCadence` implementieren: Schrittanzahl (`HKQuantityType
   stepCount`) über das Lauf-Zeitfenster holen, durch Dauer/Minuten teilen.

### Android (Health Connect / Google Fit)
1. Health-Connect-Berechtigung `android.permission.health.READ_STEPS`.
2. Analoges Plugin, `queryCadence` liefert Schritte/Min über das Lauf-Fenster.

## Bewusst offen / später
- **Anti-Teleportation serverseitig**: bräuchte Pro-Punkt-Zeitstempel im Track.
  Aktuell filtert der Client unplausible GPS-Sprünge live (MAX_SPEED pro Fix);
  eine Server-Prüfung kann folgen, sobald der Track Timestamps mitschickt.
- Solange kein Health-Plugin installiert ist, läuft alles GPS-basiert weiter —
  nichts blockiert, keine Fehlalarme.
