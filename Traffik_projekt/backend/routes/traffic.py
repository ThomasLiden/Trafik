# traffic.py

# Denna fil definierar en Flask Blueprint för att hantera trafikrelaterade API-anrop.
# Den fungerar som en proxy mellan frontend-applikationen och Trafikverkets API.

import os
import logging
from flask import Blueprint, jsonify, request # Importerar nödvändiga moduler från Flask för att skapa webb-API.
import requests # Används för att göra HTTP-anrop till externa API:er (Trafikverket).
from dotenv import load_dotenv # För att ladda miljövariabler från en .env-fil.
from pyproj import Transformer # För koordinattransformationer (om nödvändigt, t.ex. SWEREF99TM till WGS84).
from pyproj.exceptions import CRSError # Specifik felhantering för pyproj.
import re # För reguljära uttryck, används för att parsa WKT-strängar.
import json # För att hantera JSON-data.

# Ladda miljövariabler från .env-filen.
# Detta gör att känslig information som API-nycklar kan hanteras säkert utan att de hardkodas i koden.
load_dotenv()

# Skapar en Flask Blueprint. En Blueprint organiserar en uppsättning relaterade vyer och annan kod.
# Detta gör applikationen modulär och skalbar.
traffic_blueprint = Blueprint('traffic', __name__)

# Konfigurera loggning för att underlätta felsökning och övervakning.
# Loggar meddelanden till konsolen med tidsstämpel, loggnivå och meddelande.
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Hämtar Trafikverkets API-nyckel från miljövariablerna.
TRAFIKVERKET_API_KEY = os.getenv("TRAFIKVERKET_API_KEY")
# Trafikverkets API-URL för dataförfrågningar.
TRAFIKVERKET_API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"

# Initierar en koordinattransformator från SWEREF99TM (EPSG:3006) till WGS84 (EPSG:4326).
# Detta kan vara nödvändigt om Trafikverket returnerar koordinater i SWEREF99TM och frontend behöver WGS84.
# `always_xy=True` säkerställer att utdata alltid är (longitud, latitud).
try:
    transformer_sweref_to_wgs84 = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)
except CRSError as e:
    # Loggar ett fel om transformatorn inte kan skapas (t.ex. om CRS-definitioner saknas).
    logging.error(f"Could not create pyproj Transformer: {e}")
    transformer_sweref_to_wgs84 = None # Sätter till None om det misslyckas.

# Mappningar mellan länsnamn och deras motsvarande nummer enligt Trafikverket.
COUNTY_NAME_TO_NUMBER = {
    'Blekinge': 10, 'Dalarna': 20, 'Gotland': 9, 'Gävleborg': 21,
    'Halland': 13, 'Jämtland': 23, 'Jönköping': 6, 'Kalmar': 8,
    'Kronoberg': 7, 'Norrbotten': 25, 'Skåne': 12, 'Stockholm': 1,
    'Södermanland': 4, 'Uppsala': 3, 'Värmland': 17, 'Västerbotten': 24,
    'Västernorrland': 22, 'Västmanland': 19, 'Västra Götaland': 14,
    'Örebro': 18, 'Östergötland': 5
}
# Skapar en omvänd mappning från länsnummer till länsnamn för enklare uppslagning.
COUNTY_NUMBER_TO_NAME = {v: k for k, v in COUNTY_NAME_TO_NUMBER.items()}

# Loggar att filen har laddats.
logging.info("✅ traffic.py loaded!")

# Helperfunktion för att parsa WKT (Well-Known Text) POINT-strängar.
# WKT är ett textbaserat format för att representera geografiska objekt.
def parse_wgs84_point(wkt_string):
    """
    Parsar en WKT POINT-sträng (t.ex. "POINT (lon lat)") och returnerar koordinaterna
    som en lista [lat, lon] som Leaflet (och många andra kartbibliotek) förväntar sig.
    Validerar även koordinaternas intervall.
    """
    if not wkt_string or not isinstance(wkt_string, str):
        return None
    # Använder reguljära uttryck för att hitta numeriska värden inom parenteserna.
    match = re.search(r'POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)', wkt_string.strip(), re.IGNORECASE)
    if match:
        try:
            lon = float(match.group(1)) # Longitud är det första värdet i WKT POINT.
            lat = float(match.group(2)) # Latitud är det andra värdet.
            # Validerar att koordinaterna ligger inom giltiga intervall.
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return [lat, lon]  # Returnerar [lat, lon] som Leaflet behöver.
            else:
                logging.warning(f"Parsed WGS84 coordinates out of bounds: Lat {lat}, Lon {lon}")
                return None
        except ValueError:
            logging.warning(f"Could not convert WGS84 POINT coordinates to float: {wkt_string}")
            return None
        except Exception as e:
            logging.error(f"Unexpected error parsing WGS84 POINT {wkt_string}: {e}")
            return None
    else:
        # Loggar en varning om strängen inte matchar förväntat format.
        if wkt_string.strip() and not wkt_string.strip().upper().startswith("POINT"):
            logging.warning(f"WGS84 WKT string did not match expected POINT format: {wkt_string}")
        return None

# --- Endpoint för trafikinformation ---
# Definerar en route för API-anropet '/api/traffic-info' som accepterar GET-förfrågningar.
@traffic_blueprint.route('/api/traffic-info', methods=['GET'])
def get_traffic_info():
    """
    Hämtar trafikinformation från Trafikverkets API baserat på filter från frontend.
    Filtrerar på län och meddelandetyper.
    """
    # Kontrollerar om API-nyckeln är konfigurerad.
    if not TRAFIKVERKET_API_KEY:
        logging.error("Trafikverket API key not configured.")
        return jsonify({"error": "Server configuration error"}), 500

    # Hämtar filterparametrar från förfrågan.
    county_name_filter = request.args.get('county') # Länsnamn (t.ex. 'Stockholm').
    # Konverterar länsnamn till länsnummer med hjälp av mappningen.
    county_number_filter = COUNTY_NAME_TO_NUMBER.get(county_name_filter) if county_name_filter else None
    # Meddelandetyper, standard är 'Accident,Roadwork'.
    message_type_value_filter = request.args.get('messageTypeValue', 'Accident,Roadwork')

    # --- Bygg filter för Situation Query (trafikhändelser som olyckor, vägarbeten) ---
    situation_filter_elements = []
    # Lägger till filter för län om ett sådant valts.
    if county_number_filter is not None:
        situation_filter_elements.append(f'<EQ name="Deviation.CountyNo" value="{county_number_filter}" />')
    # Lägger till filter för meddelandetyper.
    if message_type_value_filter:
        message_types = [mt.strip() for mt in message_type_value_filter.split(',') if mt.strip()]
        if message_types:
            in_value_string = ','.join(message_types)
            situation_filter_elements.append(f'<IN name="Deviation.MessageTypeValue" value="{in_value_string}" />')

    # Bygger upp XML-filtret för Situation-frågan.
    situation_filter_xml = "<AND>\n <EXISTS name=\"Deviation\" value=\"true\" />" # Kräver att 'Deviation' existerar.
    if situation_filter_elements:
        situation_filter_xml += "\n" + "\n".join([" " + fe for fe in situation_filter_elements])
    situation_filter_xml += "\n </AND>"

    # --- Bygg filter för Camera Queries (fartkameror) ---
    # Fartkameror filtreras direkt på länsnummer.
    if county_number_filter is not None:
        trafficsafetycamera_filter_xml = f'<FILTER>\n <EQ name="CountyNo" value="{county_number_filter}" />\n </FILTER>'
    else:
        trafficsafetycamera_filter_xml = "<FILTER />" # Om inget län valts, hämta alla kameror.

    # Den fullständiga XML-frågan som skickas till Trafikverkets API.
    # Den innehåller två separata QUERY-block: ett för "Situation" (trafikhändelser)
    # och ett för "TrafficSafetyCamera" (fartkameror).
    xml_query = f"""
<REQUEST>
    <LOGIN authenticationkey="{TRAFIKVERKET_API_KEY}" />
    <QUERY objecttype="Situation" namespace="Road.TrafficInfo" schemaversion="1.5" orderby="Deviation.CreationTime DESC">
        <FILTER>
            {situation_filter_xml}
        </FILTER>
        <INCLUDE>Deviation.Id</INCLUDE>
        <INCLUDE>Deviation.Header</INCLUDE>
        <INCLUDE>Deviation.CreationTime</INCLUDE>
        <INCLUDE>Deviation.CountyNo</INCLUDE>
        <INCLUDE>Deviation.Geometry.Point.WGS84</INCLUDE>
        <INCLUDE>Deviation.Geometry.Point.SWEREF99TM</INCLUDE>
        <INCLUDE>Deviation.Geometry.Line.WGS84</INCLUDE>
        <INCLUDE>Deviation.Geometry.Line.SWEREF99TM</INCLUDE>
        <INCLUDE>Deviation.LocationDescriptor</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.RoadName</INCLUDE>
        <INCLUDE>Deviation.PositionalDescription</INCLUDE>
        <INCLUDE>Deviation.MessageType</INCLUDE>
        <INCLUDE>Deviation.MessageTypeValue</INCLUDE>
        <INCLUDE>Deviation.IconId</INCLUDE>
        <INCLUDE>Deviation.StartTime</INCLUDE>
        <INCLUDE>Deviation.EndTime</INCLUDE>
        <INCLUDE>Deviation.Message</INCLUDE>
        <INCLUDE>Deviation.AffectedDirection</INCLUDE>
        <INCLUDE>Deviation.SeverityText</INCLUDE>
        <INCLUDE>Deviation.TemporaryLimit</INCLUDE>
        <INCLUDE>Deviation.ValidUntilFurtherNotice</INCLUDE>
        <INCLUDE>Deviation.WebLink</INCLUDE>
        <INCLUDE>Deviation.NumberOfLanesRestricted</INCLUDE>
        <INCLUDE>Deviation.TrafficRestrictionType</INCLUDE>
        <INCLUDE>Deviation.VersionTime</INCLUDE>
    </QUERY>
    <QUERY objecttype="TrafficSafetyCamera" namespace="Road.Infrastructure" schemaversion="1">
        {trafficsafetycamera_filter_xml}
        <INCLUDE>Id</INCLUDE>
        <INCLUDE>Name</INCLUDE>
        <INCLUDE>Geometry.WGS84</INCLUDE>
        <INCLUDE>Geometry.SWEREF99TM</INCLUDE>
        <INCLUDE>CountyNo</INCLUDE>
        <INCLUDE>IconId</INCLUDE>
        <INCLUDE>Bearing</INCLUDE>
    </QUERY>
</REQUEST>
"""

    try:
        # Skickar POST-förfrågan till Trafikverkets API med den konstruerade XML-frågan.
        response = requests.post(
            TRAFIKVERKET_API_URL,
            data=xml_query.encode('utf-8'), # XML-data måste vara UTF-8 kodad.
            headers={'Content-Type': 'text/xml'} # Anger att innehållstypen är XML.
        )
        response.raise_for_status() # Kastar ett HTTPError för dåliga svar (4xx eller 5xx).

        # Parsar svaret från Trafikverket som JSON.
        response_data = response.json()

        # Försöker logga en del av svaret för debugging.
        try:
            situation_data = response_data.get('RESPONSE', {}).get('RESULT', [{}])[0].get('Situation', None)
            if situation_data:
                logging.debug(f"API Response - Situation/Deviations Data:\n{json.dumps(situation_data, indent=2, ensure_ascii=False)}")
            else:
                logging.debug("API Response did not contain 'Situation' data in the expected location.")
                logging.debug(f"Full API Response:\n{json.dumps(response_data, indent=2, ensure_ascii=False)}")
        except (IndexError, KeyError, TypeError) as e:
            logging.warning(f"Could not extract Situation data for logging: {e}")
            logging.debug(f"Full API Response:\n{json.dumps(response_data, indent=2, ensure_ascii=False)}")

        logging.info("Successfully fetched data from Trafikverket.")
        # Returnerar den hämtade JSON-datan till frontend.
        return jsonify(response_data)

    except requests.exceptions.RequestException as e:
        # Hanterar fel som uppstår under HTTP-förfrågan (t.ex. nätverksproblem, HTTP-felkoder).
        err_msg = f"Error fetching data from Trafikverket: {e}"
        status_code = e.response.status_code if e.response is not None else "N/A"
        resp_text = e.response.text if e.response is not None else "No response body"
        logging.error(f"{err_msg} - Status: {status_code} - Response: {resp_text[:500]}")
        return jsonify({"error": "Failed to fetch traffic data from Trafikverket API."}), 500
    except Exception as e:
        # Hanterar oväntade fel som kan uppstå under exekveringen.
        logging.error(f"An unexpected error occurred in get_traffic_info: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred."}), 500