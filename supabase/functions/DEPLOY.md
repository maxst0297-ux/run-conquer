# H3-Eroberung — Deploy & Verifikation (Phase 3a)

Die server-autoritative Kampf-Logik läuft als Supabase Edge Function `conquer`
(Deno) und nutzt die in Node getestete Engine `_shared/h3-engine.mjs`.

## 1. Voraussetzung: Schema anlegen
Im **Supabase SQL-Editor** einmal `supabase_h3.sql` (Repo-Wurzel) ausführen.
Legt `h3_territories`, `h3_cells`, RLS und die View `h3_territories_full` an.

## 2. Supabase CLI vorbereiten (einmalig)
```bash
npm install -g supabase          # oder: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <DEIN-PROJECT-REF>   # steht in der Supabase-URL
```

## 3. Function deployen
```bash
# im Repo-Wurzelverzeichnis (enthält supabase/functions/conquer/)
supabase functions deploy conquer
```
Die Function bekommt `SUPABASE_URL`, `SUPABASE_ANON_KEY` und
`SUPABASE_SERVICE_ROLE_KEY` automatisch als Umgebungsvariablen — nichts weiter
zu konfigurieren.

## 4. Verifikation (isoliert, ohne die App)
Hol dir ein User-JWT (z.B. aus den Browser-DevTools der eingeloggten App:
`localStorage` → `sb-<ref>-auth-token` → `access_token`) und teste einen
kleinen Rundlauf (~ein Häuserblock in München):

```bash
JWT="<access_token>"
REF="<project-ref>"
curl -s -X POST "https://$REF.functions.supabase.co/conquer" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "distanceM": 320, "durationS": 90,
    "playerName": "Tester", "userColor": "#e8ff47",
    "path": [[48.1370,11.5750],[48.1373,11.5755],[48.1376,11.5750],
             [48.1373,11.5745],[48.1370,11.5750]]
  }'
```

**Erwartet:** `{"ok":true,"points":..,"events":[{"type":"neutral_claim",...}], ...}`
und in der DB (Table Editor) eine neue Zeile in `h3_territories` + zugehörige
`h3_cells`. Ein zweiter, identischer Lauf eines anderen Nutzers durch dieselben
Zellen sollte `attacked`/`conquered`-Events liefern.

Fehlerfälle geben klaren JSON-Text zurück:
`too_short` (<150 m), `speed_hardcap` (>25 km/h), `unauthorized` (kein JWT).

## Hinweise / bewusst offen (spätere Phasen)
- Die DB-Schreibvorgänge sind sequenziell (nicht in einer einzigen Transaktion).
  Für den Start ausreichend; echtes Optimistic Locking (GDS 2.2) kommt später.
- Die App ruft die Function noch NICHT auf — das ist Phase 3b (Client-Umschaltung).
  Bis dahin läuft das alte Polygon-System unverändert weiter.
