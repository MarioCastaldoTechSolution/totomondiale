# TotoMondiale

Sito statico HTML, CSS e JavaScript per pubblicare su GitHub Pages i pronostici del file `TotoMondiale Risposte.xlsx`.

## Struttura

```text
totomondiale/
  index.html
  css/
    style.css
  js/
    app.js
  data/
    partecipanti.json
    partite.json
    classifica.json
    regolamento.json
  convert_excel_to_json.py
  README.md
```

## Cosa legge dall'Excel

Il convertitore riconosce il foglio `Risposte del modulo 1`:

- 17 partecipanti
- 72 partite dei gironi, da A a L
- pronostico 1/X/2
- risultato esatto previsto
- prima e seconda qualificata di ogni gruppo
- bonus finali: vincitore, finalisti, capocannoniere, assistman, portiere, giocatore, difesa, attacco

Nel file Excel analizzato non ci sono formule, risultati reali o punteggi gia calcolati. Per questo il sito calcola i punti in JavaScript usando `data/regolamento.json`.

## Aggiornare i dati dall'Excel

1. Aggiorna il file Excel originale:

   ```text
   ../TotoMondiale Risposte.xlsx
   ```

2. Entra nella cartella del sito:

   ```bash
   cd totomondiale
   ```

3. Rigenera i JSON:

   ```bash
   python convert_excel_to_json.py
   ```

   Se il file Excel si trova altrove:

   ```bash
   python convert_excel_to_json.py "percorso/al/file.xlsx"
   ```

Lo script aggiorna `data/partecipanti.json`, `data/partite.json`, `data/classifica.json` e `data/regolamento.json`.

## Inserire risultati reali

I risultati reali si modificano in `data/partite.json`.

Per una partita puoi compilare:

```json
{
  "risultatoReale": "2-1",
  "golCasa": 2,
  "golTrasferta": 1,
  "stato": "giocata"
}
```

Il convertitore prova a preservare i risultati reali gia presenti in `data/partite.json` quando rigeneri i dati dall'Excel.

Per i bonus reali usa le sezioni:

```json
"qualificateReali": {
  "A": { "prima": "Messico", "seconda": "Rep. Ceca" }
},
"bonusReali": {
  "vincitore": "Spagna",
  "finalisti": ["Spagna", "Brasile"],
  "capocannoniere": "Mbappe"
}
```

## Modificare il regolamento

Apri `data/regolamento.json` e cambia:

- testi nella lista `regole`
- valori dentro `punteggi`

Il sito ricalcola la classifica usando quei valori.

## Anteprima locale

Da dentro `totomondiale/` avvia un server statico:

```bash
python -m http.server 8000
```

Poi apri:

```text
http://localhost:8000
```

## Pubblicare su GitHub Pages

1. Carica la cartella `totomondiale` nel repository GitHub.
2. Vai in `Settings` -> `Pages`.
3. Seleziona il branch e la cartella da pubblicare.
4. Salva.

Il sito non usa backend, database o PHP: GitHub Pages serve solo file statici.
