# 💡 Ideen-Backlog — Motivation, Retention & Spielspaß

> Selbst­ständiges Backlog für **Runners Conquer** (RC). Jede Idee ist so
> beschrieben, dass sie später ohne weiteren Kontext umgesetzt werden kann:
> Konzept, warum es psychologisch zieht, grober Aufwand, Risiko **und** eine
> konkrete Umsetzungs­skizze mit Balancing-Zahlen.
>
> Vorgehen wie im Projekt üblich: vor dem Bau LLM-Council (`scripts/query_llms.py`)
> konsultieren, Server-Mechaniken **einzeln mit Test-Pause** ausliefern, Engine-
> Änderungen mit Tests in `supabase/functions/_shared/h3-engine.test.mjs` absichern.
> „Bau Idee N" genügt später als Auftrag.

---

## Kontext — was RC **schon** kann (Stand v201, damit nichts doppelt gebaut wird)

- **Kern:** Erobern von H3-Hexagonen (Res 10) durch echtes Laufen; **tempo-basierte
  Punkte** (Pace-Faktor je Hexagon); **Verfall** der Gebiete über Zeit
  (`decayedDefense`, 8/Tag); **dichte-faire** Neutral-Claim-Wertung.
- **Gegner/Fraktionen:** Bots als Rivalen; **benannte Bot-Angriffe** in
  Benachrichtigungen (`bot_attacks`); 4 Fraktionen mit **monatlichem
  Fraktionskrieg** (70 % Gebiete + 30 % XP); **lokale Fraktions-Kontrolle** je
  Region (Nachbarschaft Res 8 / Stadtteil Res 7 / Stadt Res 5).
- **Retention/Boosts:** Comeback-Hook nach Verlusten; **Bollwerk-Boost**
  (+50 % Verteidigung, aus Season-Pass); **Gebiets-Schutz** (24 h Immunität);
  **Heimatkern** (markiertes Gebiet verfällt halb so schnell, solange < 30 Tage
  aktiv); **Season-Pass** (18 Level); Streaks; tägliche & wöchentliche
  Challenges; Starter-Quests; Titel; Erfolge; Energie-Boost (+10 % Angriff).
- **Sozial:** Klubs (mit Beschreibung, Mitglieder, Gesamtpunkte/-gebiete);
  Follower-System (+ Follower-Liste); Live-Aktivität (mit echter „vor X Min."-
  Zeit); Ranglisten (Umkreis 20 km + weltweit); Wahrzeichen (Landmarks).
- **Technik:** Single-File `index.html` (IIFE); shared Engine
  `supabase/functions/_shared/h3-engine.mjs` (von `conquer` + `bot_tick` genutzt);
  Client-asserted Boosts (wie Energie/Bollwerk) vermeiden oft SQL; H3-Helfer:
  `gridDisk`, `cellToParent`, `cellToBoundary`, `gridPathCells`.

Quelle der Ideen: LLM-Council (Gemini, Nov-2025-Konsultation) + eigene Ergänzungen.

---

## 🥇 Sofort-Kandidaten (viel Wirkung, wenig Aufwand)

### 1. Hex-Ketten & Korridore  — *Engine*
- **Konzept:** Zusammenhängende Ketten aus **≥ 5 verbundenen** eigenen Hexagonen
  erzeugen einen **Versorgungs-Bonus**: halbe Verfallsrate **und** +20 % Punkte
  beim Laufen in diesem Areal.
- **Psychologie:** Gestaltpsychologie (Drang, Formen/Linien zu vervollständigen)
  → verwandelt planloses Laufen in **Routenstrategie**.
- **Aufwand:** Engine (Geometrie-Prüfung beim Erobern/Verlieren). Kein neuer
  Screen. Nutzt H3-Nachbarschaft (`gridDisk(c,1)`), die schon da ist.
- **Risiko:** Domino-Frust, wenn ein einzelnes Kettenglied fällt.
- **Umsetzungsskizze:**
  - Verbundenheit: Zusammenhangskomponenten über die eigenen Zellen bilden
    (BFS über `gridDisk(c,1)`-Nachbarn, die ebenfalls dem Spieler gehören).
  - Ab Komponentengröße ≥ 5 gilt jede Zelle darin als „vernetzt".
  - Decay: für vernetzte Zellen `ratePerDay = DECAY_PER_DAY * 0.5` (analog zum
    Heimatkern-Mechanismus `homeDecayRate`).
  - Punkte: beim Neutral-Claim/Verteidigen in vernetztem Areal `× 1.2`.
  - Domino-Puffer: Bonus erst verlieren, wenn Komponente **2 Tage** unter 5 fällt
    (Karenz), nicht sofort.
  - Tests: Komponentengröße, Decay-Halbierung, Karenz.

### 2. Instabile Anomalien  — *Engine + kleine Client-UI*
- **Konzept:** Seltene Hex-Cluster erscheinen für **~4 h** auf der Karte
  („Anomalien"), geben **5× Punkte**, sind aber nur bei **sehr langsamem**
  (Regeneration/Gehen) **oder sehr schnellem** (Sprint) Tempo eroberbar.
- **Psychologie:** FOMO + Varianz — bricht Trainings-Monotonie, „heute ist was los".
- **Aufwand:** Engine (Zeit-getriggerter Spawner, Sonder-Wertung) + Karten-Marker.
- **Risiko:** Verkehrssicherheit (keine Sprints im Verkehr provozieren) → im UI
  klar zu Vorsicht mahnen; **keine** Spawns bei Nacht / an Hauptstraßen.
- **Umsetzungsskizze:**
  - Spawn: deterministisch pro Region/Zeitfenster (z. B. Seed aus Datum+Region),
    damit server-autoritativ und testbar; 1–3 Cluster à 3–7 Zellen.
  - Fenster: `active_from`/`active_to` (4 h). Tabelle `anomalies` **oder** rein
    prozedural aus Seed (spart DB).
  - Wertung: nur gültig, wenn `paceKmh <= 5` **oder** `>= 15`; sonst 0.
  - Punkte: `× 5` auf den Neutral-/Angriffswert innerhalb der Anomalie.
  - Client: pulsierender Marker + Countdown + Sicherheits­hinweis.

---

## 🥈 Stärkster Retention-Hebel (mittlerer Aufwand)

### 3. Aura-Ernte (Ressourcen-Extraktion)  — *Engine + DB*
- **Konzept:** Eroberte Gebiete produzieren über Zeit eine Zweitwährung **„Aura"**,
  die man **physisch einsammeln** muss (drüberlaufen), bevor das Gebiet verfällt
  oder übernommen wird.
- **Psychologie:** Endowment-Effekt (man will das selbst Produzierte nicht
  verlieren) + tägliche Sammel-Routine → starker Grund zurückzukommen.
- **Aufwand:** Engine (Ticker/Lazy-Accrual) + DB (Aura-Stand pro Gebiet/Spieler)
  + „wofür gibt man Aura aus?".
- **Risiko:** Spieler fokussieren „sichere" Gebiete, vernachlässigen Expansion.
- **Umsetzungsskizze:**
  - Accrual lazy (kein Scheduler): `aura = min(cap, rate * Stunden_seit_letzter_Ernte)`
    pro Gebiet; `rate` skaliert mit Größe/Seltenheit; `cap` z. B. 24 h Produktion.
  - Ernte: beim Durchlaufen eines eigenen Gebiets Aura gutschreiben + Timer reset.
  - Senke: Aura kauft Bollwerk / Gebiets-Schutz / kosmetische Farben → schließt den
    Loop und entlastet den Season-Pass als einzige Boost-Quelle.
  - DB: `profiles.aura` (Summe) + pro Gebiet `aura_since` (Zeitstempel) — oder
    Aura komplett client-asserted mit Server-Deckelung (wie Energie), spart Schema.
  - Risiko-Gegenmittel: Aura-`rate` sinkt für lange **nicht erweiterte** Reviere.

---

## 🥉 Größer & sozialer (später)

### 4. Klub-Außenposten  — *Client + Engine + DB*
- **Konzept:** Klubs errichten an einem kontrollierten Wahrzeichen einen
  **Außenposten**, der durch **gemeinsame Kilometer** aller Mitglieder gelevelt
  wird und einen permanenten **Verteidigungs-Radius** für die Umgebung gibt.
- **Psychologie:** Social Proof + kollektive Selbstwirksamkeit („wir bauen etwas
  Bleibendes").
- **Aufwand:** höher — Bau-Fortschritt-UI, Radius-Buff-Logik, DB (`club_outposts`).
- **Risiko:** übermächtige Klubs machen Stadtteile für Gelegenheits­spieler
  unspielbar → **Hard-Cap** für Radius + Level, Anzahl Außenposten pro Klub begrenzt.
- **Umsetzungsskizze:** Außenposten an Landmark-Zelle; `level` steigt mit Klub-km;
  Buff = reduzierter Verfall (z. B. −25 %) für Klub-Gebiete im Radius (Res-7-Parent);
  Cap Level 5, max. 3 Außenposten/Klub.

### 5. Phantom-Duelle (asynchrones Solo-PvP)  — *Client + DB*
- **Konzept:** Läufer hinterlegen auf selbst gewählter Strecke eine Bestzeit;
  andere, die die Strecke kreuzen, fordern das **Phantom** heraus und übernehmen
  bei Sieg das Start-Hex sofort.
- **Psychologie:** Kompetenz-Erleben + sozialer Vergleich ohne Gleichzeitigkeit.
- **Aufwand:** höher — Strecken-/Segment-Matching, Geist-Vergleichs-UI.
- **Risiko:** Cheating (E-Bike/Auto) → strikte Tempo-Validierung (`validateTrack`,
  `HARD_MAX_KMH`) zwingend.
- **Umsetzungsskizze:** Segment = geglättete Zellfolge; „Phantom" speichert
  Zeit-pro-Zelle; Herausforderung vergleicht kumulative Zeit; nur bei bestandener
  Anti-Cheat-Prüfung zählt der Sieg.

---

## 💡 Günstige Ergänzungen (klein, hoher „Juice")

### 6. Nemesis-System  — *fast nur Client, baut auf `bot_attacks` auf*
- **Konzept:** Aus benannten Bot-Angriffen wird ein **persönlicher Rivalen-Score**
  („Roter Wolf hat dir 3× Gebiete genommen — Revanche!"). Erfolgreiche Rückeroberung
  zahlt extra + „Nemesis besiegt".
- **Psychologie:** personifizierter Gegner → emotionale Bindung, Rache-Motivation.
- **Aufwand:** klein — vorhandene `bot_attacks` je Bot zählen; Revanche = nächste
  Eroberung eines Gebiets dieses Bots; Client-UI + kleine Zählung.
- **Risiko:** gering; nur Balancing der Extra-Belohnung.

### 7. Wochen-Fokus (Community-Wochenziel)  — *klein, nutzt Challenge-Infra*
- **Konzept:** Ein einziges, prominentes **Community-/Fraktions-Wochenziel** mit
  Belohnung (z. B. „Diese Woche: erobert 50 Wahrzeichen als Fraktion X").
- **Psychologie:** gemeinsames Ziel + Fortschrittsbalken → Zugehörigkeit, wiederkehr.
- **Aufwand:** klein — vorhandene Wochen-Challenge-/Event-Mechanik erweitern.
- **Risiko:** gering; Ziel-Skalierung an Spielerzahl anpassen.

---

## Empfohlene Reihenfolge (Wirkung ÷ Aufwand)

1. **Hex-Ketten** — sofortiger strategischer Tiefgang, Engine-only, gut testbar.
2. **Aura-Ernte** *(oder)* **Anomalien** — je nach Ziel: *tägliche Rückkehr* (Aura)
   vs. *Abwechslung/FOMO* (Anomalien).
3. **Nemesis** — billiger emotionaler Hebel, baut auf Vorhandenem auf.
4. **Wochen-Fokus** — leichtgewichtiges Gemeinschaftsziel.
5. **Klub-Außenposten** — langfristiges High-Level-Klub-Ziel.
6. **Phantom-Duelle** — stärkster Solo-Wettbewerb, aber aufwändigstes Matching/Anti-Cheat.
