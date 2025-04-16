# Trafikinformation Projektuppgift

## Mappstruktur

## Lägg gärna till fler filer/mappar som behövs, detta är endast exempel på vad som kan behövas!

## 

### Backend (`/backend`)
- `app.py` - Huvudfilen som startar Flask-servern, antar att det är så vi ska ha?

- `requirements.txt` - Lista på Python-paket som behövs eller andra tekniker som man behöver installera, skriv gärna upp om ni använder något som man behöver installera!

#### `/backend/app/`
- `models/` - Databasmodeller
- `routes/` - API endpoints (där vi tar emot requests) 
- `services/` - Logik för att prata med Trafikverkets API etc
- `utils/` - Hjälpfunktioner som används i flera delar, eller övrigt?

### Frontend (`/frontend/src`)
- `assets/` - Bilder, ikoner och andra liknande filer vi använder oss av

- `components/` - alla Vue-komponenter
  - `map/` - Komponenter specifikjt för kartan
  - `ui/` - Mer generella komponenter (knappar, forms, etc)
- `views/` - Hela sidor/vyer
- `services/` - Kod som pratar med backend
- `store/` - Vuex/state management
- `router/` - Vue router, alltså sidnavigering
- `App.vue` - Huvud Vue-komponenten
- `main.js` - Startpunkt för frontend


