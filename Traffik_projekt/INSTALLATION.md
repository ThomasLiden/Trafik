# Installationsguide för Trafiktjänsten (Egen Frontend-Hosting)

## Introduktion
Denna guide beskriver hur du installerar och konfigurerar Trafiktjänstens frontend på din egen webbserver (`www.dagspressutgivarna.se`) hos Loopia. Tjänstens backend (API) driftas av [Utvecklarna AB].

## Paketets Innehåll
Du ska ha mottagit ett paket (t.ex. en ZIP-fil) som innehåller:
1.  `trafiktjanst_frontend_dist/`: En mapp med alla filer för Trafiktjänstens frontend-applikation.
2.  `iframe_host_template.html`: En mallfil för att bädda in Trafiktjänsten.
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

1.  **Kopiera Mallen:** Ta filen `iframe_host_template.html` och döp om den till något passande, t.ex. `visa_trafiktjanst.html`. Placera denna fil där du vill att den ska vara åtkomlig på din webbplats (t.ex. i roten `public_html/` eller i en specifik undermapp).
2.  **Redigera Inbäddningssidan:** Öppna din nyskapade fil (t.ex. `visa_trafiktjanst.html`) i en textredigerare.
3.  **Ställ in Sökväg (VIKTIGT):**
    Leta upp raden (inuti `<script>`-taggen):
    ```javascript
    const vueAppBasePath = './'; 
    ```
    Anpassa värdet för `vueAppBasePath` så att det korrekt pekar på mappen där du laddade upp Trafiktjänstens filer (från Del 1), **relativt till platsen för `visa_trafiktjanst.html`**.
    * Om `visa_trafiktjanst.html` är i `public_html/` och app-filerna i `public_html/trafiktjanst/`, är `'./trafiktjanst/'` korrekt.
    * Om `visa_trafiktjanst.html` är i `public_html/min_sida/` och app-filerna i `public_html/trafiktjanst/`, ändra till `'../trafiktjanst/'`.
    * Om `visa_trafiktjanst.html` är i *samma* mapp som app-filerna (t.ex. båda i `public_html/trafiktjanst/`), behåll då `'./'`.
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
När allt är uppladdat och konfigurerat, och ni har fått bekräftelse från oss att er domän är tillagd, besök sidan där du placerade `visa_trafiktjanst.html` (t.ex. `https://www.dagspressutgivarna.se/visa_trafiktjanst.html`).

## Felsökning
* **Tom iframe / "File not found":** Troligtvis fel i `vueAppBasePath`. Dubbelkolla sökvägen. Säkerställ att alla filer från `trafiktjanst_frontend_dist/` är korrekt uppladdade.
* **Ingen data / Fel i webbläsarkonsolen (t.ex. CORS-fel):** Er domän är troligen inte korrekt tillagd i vårt API:s CORS-inställningar. Kontakta oss (se Del 3).
* **Stiländringar syns inte:** Rensa webbläsarens cache. Kontrollera att `customerStyleConfig`-värdena är korrekta CSS-värden och att du sparat ändringarna i `visa_trafiktjanst.html`.

För ytterligare support, kontakta Utvecklarna AB.
