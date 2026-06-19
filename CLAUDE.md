# Projektrichtlinien

## LLM Council automatisch nutzen

Der Skill `llm-council` (`.agents/skills/llm-council/SKILL.md`) ist in diesem Projekt **immer aktiv** —
nicht erst, wenn der Nutzer explizit "konsultiere den Rat" o.ä. sagt.

Bei jeder Aufgabe in diesem Repo, bevor ein Implementierungsplan oder eine nicht-triviale Code-Änderung
präsentiert wird:
1. `scripts/query_llms.py` mit der relevanten Fragestellung ausführen, um Perspektiven von ChatGPT und Gemini einzuholen.
2. Antworten analysieren und in die eigene Analyse einfließen lassen.
3. Den finalen Plan/die Änderung mit kurzer Zuschreibung präsentieren (z.B. "ChatGPT schlug X vor, Gemini wies auf Y hin").

Ausnahme: triviale, eindeutige Ein-Zeilen-Fixes oder reine Rückfragen brauchen keine Council-Konsultation.
