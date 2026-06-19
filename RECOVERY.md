# RECOVERY.md — Hente TriggerPull tilbake på en ny PC

Denne guiden er skrevet for deg som **ikke er programmerer**. Følg stegene i
rekkefølge. Alt du skal skrive står i grå bokser — skriv det **nøyaktig** som
det står, og trykk Enter etter hver linje.

> Hele prosjektet ligger trygt på GitHub: **https://github.com/Lun4t3ch/TriggerPull**
> Selve nettsiden kjører på Cloudflare Pages og påvirkes ikke av at du henter
> koden ned på nytt. Du trenger bare dette hvis du vil **jobbe videre på koden**
> fra en ny maskin.

---

## Hvor skriver jeg kommandoene?

Vi bruker **PowerShell** (følger med Windows):

1. Trykk **Windows-tasten**.
2. Skriv `powershell`.
3. Trykk Enter. Et blått/svart vindu åpnes — det er der du skriver kommandoene.

Hver «grå boks» under er én eller flere kommandoer. Lim inn (høyreklikk =
lim inn i PowerShell), og trykk Enter.

---

## Steg 1 — Installer de tre verktøyene du trenger

Du trenger **Git**, **Node.js** og **Claude Code**. Sjekk først om de allerede
finnes. Kjør i PowerShell:

```powershell
git --version
node --version
```

- Får du et versjonsnummer (f.eks. `git version 2.x` / `v24.x`) → den er
  installert, hopp over.
- Får du «not recognized» → installer den slik:

**Git:** Last ned fra **https://git-scm.com/download/win**, kjør installasjonen,
klikk «Next» gjennom hele (standardvalg er fine).

**Node.js:** Last ned **LTS**-versjonen fra **https://nodejs.org**, kjør
installasjonen, klikk «Next» gjennom hele.

**Claude Code:** Kjør i PowerShell:
```powershell
npm install -g @anthropic-ai/claude-code
```

> **Lukk og åpne PowerShell på nytt** etter at du har installert noe — ellers
> «ser» det ikke de nye verktøyene.

---

## Steg 2 — Velg hvor prosjektet skal ligge

Vi legger det i samme mappe som det lå før (`OneDrive\WibeCode`). Kjør:

```powershell
cd "$env:USERPROFILE\OneDrive\WibeCode"
```

Finnes ikke den mappa? Lag den først, så gå inn i den:
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\OneDrive\WibeCode"
cd "$env:USERPROFILE\OneDrive\WibeCode"
```

---

## Steg 3 — Hent (klon) prosjektet fra GitHub

```powershell
git clone https://github.com/Lun4t3ch/TriggerPull.git
```

Første gang kan Git be deg logge inn på GitHub — logg inn som **Lun4t3ch** i
vinduet som dukker opp. Etterpå husker maskinen det.

Gå inn i prosjektmappa:
```powershell
cd TriggerPull
```

---

## Steg 4 — «Gjenskap .env»

TriggerPull trenger **ingen** hemmelige miljøvariabler eller `.env`-fil for å
kjøre. Det finnes en mal-fil (`.env.example`) bare som dokumentasjon — du
trenger ikke gjøre noe her. (Hvis en fremtidig versjon krever en `.dev.vars`-fil
for lokale Cloudflare-funksjoner, står det forklart i `.env.example`.)

Du kan trygt hoppe videre. ✅

---

## Steg 5 — Installer prosjektets «pakker»

Dette laster ned bibliotekene koden bruker (mappa `node_modules`, som med vilje
IKKE ligger på GitHub). Kjør:

```powershell
npm install
```

Det tar et minutt eller to første gang. Det er normalt at det skriver mange
linjer.

---

## Steg 6 — Kjør appen lokalt på din egen PC

For at innloggingen mot Shoot'n Score It skal virke lokalt må både nettsiden
**og** proxy-funksjonene kjøre. Kjør denne ene kommandoen:

```powershell
npx wrangler pages dev -- npm run dev
```

- Første gang spør den kanskje om å installere «wrangler» — svar **ja** (`y`).
- Den skriver til slutt en adresse, typisk **http://localhost:8788**.
- Åpne den adressen i nettleseren → du ser TriggerPull og kan logge inn med
  din SSI-konto.

For å **stoppe** appen: klikk i PowerShell-vinduet og trykk **Ctrl + C**.

> Bare `npm run dev` alene gir deg nettsiden, men innlogging vil feile (proxy-en
> mangler). Bruk kommandoen over.

---

## Steg 7 — Åpne prosjektet i Claude Code igjen

Stå i prosjektmappa (du er der etter Steg 3) og kjør:

```powershell
claude
```

Claude Code starter i mappa og leser automatisk **CLAUDE.md**, så den forstår
hele prosjektet med en gang. Da kan du bare beskrive hva du vil endre.

For å åpne det senere fra nytt PowerShell-vindu:
```powershell
cd "$env:USERPROFILE\OneDrive\WibeCode\TriggerPull"
claude
```

---

## Steg 8 — Hvordan endringer havner på nett (triggerpull.org)

Du gjør **ingenting** manuelt for å deploye. Når en endring er lagret på GitHub
(Claude tar `git commit` + `git push` for deg når du godkjenner), bygger
**Cloudflare Pages** den automatisk og oppdaterer **triggerpull.org** etter
1–2 minutter. Du kan følge byggingen på **https://dash.cloudflare.com** →
Workers & Pages → `triggerpull` → Deployments.

---

## Hjelp, noe gikk galt

- **«not recognized» / «command not found»:** Verktøyet er ikke installert, eller
  du må lukke og åpne PowerShell på nytt etter installasjonen (Steg 1).
- **`git clone` ber om innlogging om og om igjen:** Logg inn som **Lun4t3ch** i
  pop-up-vinduet fra GitHub. Riktig konto er viktig.
- **Innlogging i appen feiler lokalt:** Sjekk at du brukte kommandoen i Steg 6
  (med `wrangler`), ikke bare `npm run dev`.
- **Node finnes, men `npm` virker ikke:** Lukk PowerShell, åpne på nytt, prøv
  igjen.
- **Alt annet:** Åpne Claude Code i mappa (`claude`) og forklar problemet — den
  kan lese koden og hjelpe deg direkte.
