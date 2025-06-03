# Installationsguide för Trafiktjänsten (Egen Frontend-Hosting)

## Introduktion
Denna guide beskriver hur du installerar och konfigurerar Trafiktjänstens frontend på din egen webbserver (`www.dagspressutgivarna.se`) hos Loopia. Tjänstens backend (API) driftas av [Utvecklarna AB].

## Paketets Innehåll
Du ska ha mottagit ett paket (t.ex. en ZIP-fil) som innehåller:
1.  `trafiktjanst_frontend_dist/`: En mapp med alla filer för Trafiktjänstens frontend-applikation.
2.  `index.html`: En mallfil för att bädda in Trafiktjänsten.
3.  Denna installationsguide (`INSTALLATION.md`).

## Installationssteg

### Del 1: Ladda upp Frontend-Applikationen

1.  **Packa upp:** Packa upp den mottagna ZIP-filen.
2.  **Anslut till Servern:** Logga in på ditt Loopia-konto (eller anslut via FTP) och navigera till din webbplats rotmapp (oftast `public_html` eller `www`).
3.  **Skapa Mapp (Rekommenderat):** Skapa en ny mapp för Trafiktjänstens filer, t.ex. `trafiktjanst`.
    * Exempel: `public_html/trafiktjanst/`
4.  **Ladda upp Filer:** Ladda upp *allt innehåll* från mappen `trafiktjanst_frontend_dist/` (som du packade upp) till den nyskapade mappen på din server (t.ex. till `public_html/trafiktjanst/`).
    Strukturen bör då likna:
    ```
    public_html/
    └── trafiktjanst/  <-- Hit laddades innehållet från trafiktjanst_frontend_dist/ upp
        ├── index.html
        ├── js/
        ├── css/
        └── ... (andra filer/mappar)
    ```

### Del 2: Konfigurera och Placera Inbäddningssidan

1.  **Kopiera Mallen:** Ta filen `index.html` och placera denna fil där du vill att den ska vara åtkomlig på din webbplats (t.ex. i roten `public_html/` eller i en specifik undermapp).
2.  **Redigera Inbäddningssidan:** Öppna din nyskapade fil (t.ex. `index.html`) i en textredigerare.
3.  **Ställ in Sökväg (VIKTIGT):**
    Leta upp raden (inuti `<script>`-taggen):
    ```javascript
    const vueAppBasePath = './';
    ```
    Anpassa värdet för `vueAppBasePath` så att det korrekt pekar på mappen där du laddade upp Trafiktjänstens filer (från Del 1).

    Här är några vanliga scenarier för `vueAppBasePath`:
    * **Scenario A (Rekommenderat i Del 1):** Om din `index.html` (värdsidan) ligger i `public_html/` och Vue-appens filer (från `trafiktjanst_frontend_dist/`) har laddats upp till `public_html/trafiktjanst/`:
    Då ska `vueAppBasePath` vara `'./trafiktjanst/'`. (Detta matchar exemplet i kod-blocket ovan).

    * **Scenario B:** Om din `index.html` (värdsidan) placeras *inuti* samma mapp som Vue-appens filer (t.ex. du placerade värdsidans `index.html` i `public_html/trafiktjanst/` tillsammans med Vue-appens egen `index.html` och dess js/css-mappar): Då ska `vueAppBasePath` vara `'./'`.

    * **Scenario C:** Om din `index.html` (värdsidan) ligger i en undermapp, t.ex. `public_html/min-sida/`, och Vue-appens filer ligger i `public_html/trafiktjanst/`: Då ska `vueAppBasePath` vara `'../trafiktjanst/'`.

    Kontrollera noggrant att denna sökväg blir korrekt för din filstruktur. Det är här det oftast blir fel om iframen inte laddas.


4.  **Anpassa Utseende (Valfritt):**
    Leta upp sektionen `customerStyleConfig`:
    ```javascript
    const customerStyleConfig = {
        fontFamily: "Georgia, serif", // Ditt val av typsnitt
        primaryColor: "#006400",      // Din primära accentfärg
        // ... eventuella andra framtida parametrar ...
    };
    ```
    Ändra värdena för `fontFamily` (typsnitt för brödtext och rubriker) och `primaryColor` (primärfärg för knappar) som passar din tidning.
     Använd giltiga CSS-värden (t.ex. typsnittsnamn inom citattecken, färger som `"#RRGGBB"`).
5.  **Anpassa Iframe-storlek (Valfritt):**
    Du kan ändra `width` och `height` för `<iframe id="appIframe" ...>` direkt i HTML-koden om standardvärdena (1000x400) inte passar - detta är dock INTE rekommenderat för bästa användarupplevelse.

### Del 3: Informera [Utvecklarna AB] om Domänen (VIKTIGT)
För att Trafiktjänsten ska kunna hämta data från vårt API måste er domän (`www.dagspressutgivarna.se`) vara godkänd. **Kontakta Utvecklarna AB och meddela att installationen är gjord på `https://www.dagspressutgivarna.se`** så att vi kan slutföra konfigurationen på vår sida.

### Del 4: Testa
När allt är uppladdat och konfigurerat, och ni har fått bekräftelse från oss att er domän är tillagd, besök sidan där du placerade `index.html` (t.ex. `https://www.dagspressutgivarna.se/index.html`).

## Felsökning
* **Tom iframe / "File not found":** Troligtvis fel i `vueAppBasePath`. Dubbelkolla sökvägen. Säkerställ att alla filer från `trafiktjanst_frontend_dist/` är korrekt uppladdade.
* **Ingen data / Fel i webbläsarkonsolen (t.ex. CORS-fel):** Er domän är troligen inte korrekt tillagd i vårt API:s CORS-inställningar. Kontakta oss (se Del 3).
* **Stiländringar syns inte:** Rensa webbläsarens cache. Kontrollera att `customerStyleConfig`-värdena är korrekta CSS-värden och att du sparat ändringarna i `index.html`.

För ytterligare support, kontakta Utvecklarna AB.
