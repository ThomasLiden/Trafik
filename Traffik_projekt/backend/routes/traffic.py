from flask import Blueprint, jsonify, current_app, request
import requests
import os
from dotenv import load_dotenv
from pyproj import Transformer
import re

# Ladda miljövariabler om de inte redan är laddade globalt i app.py
load_dotenv()

traffic_blueprint = Blueprint('traffic', __name__)

# Hämta API-nyckeln från .env (säkert)
TRAFIKVERKET_API_KEY = os.getenv("TRAFIKVERKET_API_KEY")
TRAFIKVERKET_API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"

# Skapa en Transformer för att konvertera från SWEREF99TM till WGS84
transformer = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)

# Mappning från länsnamn (som används i frontend) till länsnummer (som används i Trafikverkets API)
# Detta är baserat på Trafikverkets dokumentation för länsnummer.
COUNTY_NAME_TO_NUMBER = {
    'Blekinge': 10,
    'Dalarna': 20,
    'Gotland': 9,
    'Gävleborg': 21,
    'Halland': 13,
    'Jämtland': 23,
    'Jönköping': 6,
    'Kalmar': 8,
    'Kronoberg': 7,
    'Norrbotten': 25,
    'Skåne': 12,
    'Stockholm': 1,
    'Södermanland': 4,
    'Uppsala': 3,
    'Värmland': 17,
    'Västerbotten': 24,
    'Västernorrland': 22,
    'Västmanland': 19,
    'Västra Götaland': 14,
    'Örebro': 18,
    'Östergötland': 5
}

# Mappning från länsnummer till länsnamn för att visa i frontend (popup)
COUNTY_NUMBER_TO_NAME = {v: k for k, v in COUNTY_NAME_TO_NUMBER.items()}


print("✅ traffic.py är laddad!")

def extract_coordinates_from_wkt(wkt_string):
    """
    Extraherar koordinater (lat, lon) från en WKT-sträng (POINT eller LINESTRING)
    och konverterar från SWEREF99TM till WGS84.
    Returnerar [lat, lon] för POINT eller den första punkten [lat, lon] för LINESTRING.
    """
    if not wkt_string:
        return None

    if wkt_string.startswith("POINT("):
        match = re.search(r'POINT\((\d+\.?\d*) (\d+\.?\d*)\)', wkt_string)
        if match:
            x_sweref = float(match.group(1))
            y_sweref = float(match.group(2))
            # Transformerar från SWEREF99TM (x, y) till WGS84 (lon, lat)
            lon, lat = transformer.transform(x_sweref, y_sweref)
            return [lat, lon]
    elif wkt_string.startswith("LINESTRING("):
        coordinates = []
        # Hitta alla koordinatpar i LINESTRING
        matches = re.findall(r'(\d+\.?\d*) (\d+\.?\d*)', wkt_string)
        for match in matches:
            x_sweref = float(match[0])
            y_sweref = float(match[1])
            # Transformerar varje punkt
            lon, lat = transformer.transform(x_sweref, y_sweref)
            coordinates.append([lat, lon])
        # Returnera den första punkten för enkel markering på kartan
        return coordinates[0] if coordinates else None

    return None # Returnera None om WKT-strängen inte matchas eller är tom


@traffic_blueprint.route('/api/traffic-situations', methods=['GET'])
def get_traffic_situations():
    """
    Hämtar trafiksituationer från Trafikverkets API, filtrerar på län och meddelandetyp ('Accident'),
    konverterar koordinater och returnerar som JSON.
    """
    if not TRAFIKVERKET_API_KEY:
        current_app.logger.error("Trafikverket API key not configured.")
        return jsonify({"error": "Trafikverket API key not configured"}), 500

    # Hämta filter från request-parametrar
    # Frontend skickar länsnamnet, vi konverterar till länsnummer
    county_name_filter = request.args.get('county')
    county_number_filter = COUNTY_NAME_TO_NUMBER.get(county_name_filter) if county_name_filter else None
    message_type_value_filter = request.args.get('messageTypeValue') # Ska vara 'Accident'

    # Bygg upp FILTER-delen av XML-frågan baserat på inkommande parametrar
    filter_elements = [] # Starta med en tom lista

    if county_number_filter is not None:
        # Lägg till filter för länsnummer om det finns i requesten
        # Använd <IN> för att filtrera på värden i en lista (Deviation.CountyNo är int[])
        # Skicka värdet som en enkel sträng utan extra kommatecken
        filter_elements.append(f'<IN name="Deviation.CountyNo" value="{county_number_filter}" />')
        current_app.logger.debug(f"Filtering by County Number: {county_number_filter} ({county_name_filter}) using IN on CountyNo.")

    if message_type_value_filter:
        # Lägg till filter för meddelandetypvärde om det finns i requesten
        filter_elements.append(f'<EQ name="Deviation.MessageTypeValue" value="{message_type_value_filter}" />')
        current_app.logger.debug(f"Filtering by MessageTypeValue: {message_type_value_filter}")

    # Om inga specifika filter (län eller meddelandetyp) finns, lägg till EXISTS-filtret
    # Annars, om det finns filter, se till att Deviation existerar
    if not filter_elements:
         filter_elements.append('<EXISTS name="Deviation" value="true" />')
         current_app.logger.debug("No specific filters, adding EXISTS filter.")
    else:
         # Om vi har specifika filter, se till att Deviation-objektet finns
         filter_elements.insert(0, '<EXISTS name="Deviation" value="true" />')
         current_app.logger.debug("Specific filters present, adding EXISTS filter at the beginning.")


    # Kombinera filterelementen med <AND> om det finns fler än ett filter
    if len(filter_elements) > 1:
        filter_xml = "<AND>\n" + "\n".join(filter_elements) + "\n</AND>"
    else:
        filter_xml = filter_elements[0] # Använd bara det enda filterelementet

    # Definiera XML-frågan till Trafikverkets API
    # Inkludera nödvändiga fält, inklusive Geometry.SWEREF99TM, Deviation.CountyNo och Deviation.MessageTypeValue
    # Säkerställ korrekt XML-struktur och indrag
    xml_query = f"""
<REQUEST>
    <LOGIN authenticationkey="{TRAFIKVERKET_API_KEY}" />
    <QUERY objecttype="Situation" namespace="Road.TrafficInfo" schemaversion="1.5" orderby="Deviation.CreationTime DESC">
        <FILTER>
{filter_xml}
        </FILTER>
        <INCLUDE>Deviation.Id</INCLUDE>
        <INCLUDE>Deviation.Header</INCLUDE>
        <INCLUDE>Deviation.CreationTime</INCLUDE>
        <INCLUDE>Deviation.CountyNo</INCLUDE>
        <INCLUDE>Deviation.Geometry.SWEREF99TM</INCLUDE>
        <INCLUDE>Deviation.Geometry.WGS84</INCLUDE>
        <INCLUDE>Deviation.LocationDescriptor</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.RoadName</INCLUDE>
        <INCLUDE>Deviation.PositionalDescription</INCLUDE>
        <INCLUDE>Deviation.Message</INCLUDE>
        <INCLUDE>Deviation.MessageType</INCLUDE>
        <INCLUDE>Deviation.MessageTypeValue</INCLUDE>
        <INCLUDE>Deviation.SeverityText</INCLUDE>
        <INCLUDE>Deviation.StartTime</INCLUDE>
        <INCLUDE>Deviation.EndTime</INCLUDE>
        <INCLUDE>Deviation.IconId</INCLUDE>
    </QUERY>
</REQUEST>
"""

    headers = {'Content-Type': 'text/xml'}

    try:
        current_app.logger.debug(f"Sending XML query to Trafikverket:\n{xml_query}")
        response = requests.post(TRAFIKVERKET_API_URL, data=xml_query.encode('utf-8'), headers=headers)
        response.raise_for_status()  # Kasta ett undantag för dåliga svar (4xx eller 5xx)

        data = response.json()
        # current_app.logger.debug(f"Received data from Trafikverket (partial): {str(data)[:500]}...") # Logga del av svaret

        # Kontrollera om sökvägen till situationer är giltig
        situations_result = data.get("RESPONSE", {}).get("RESULT", [])
        if not situations_result:
             current_app.logger.warning("No RESULT found in Trafikverket response.")
             return jsonify([]), 200 # Returnera tom lista om inget RESULT finns

        # Antag att situationerna finns i det första RESULT-objektet
        situations = situations_result[0].get("Situation", [])
        current_app.logger.debug(f"Found {len(situations)} situations in response.")

        # Loopa igenom situationerna och konvertera WKT till [lat, lon] för varje avvikelse
        processed_situations = []
        for situation in situations:
            deviation_list = situation.get("Deviation")
            # Kontrollera att Deviation existerar och är en lista
            if deviation_list and isinstance(deviation_list, list):
                 processed_deviations = []
                 for dev in deviation_list:
                    # Förbättrad hantering av Geometry
                    geometry_data = dev.get("Geometry")
                    coordinates = None
                    if geometry_data:
                        wkt_geometry_point = geometry_data.get("PointSWEREF99TM")
                        wkt_geometry_line = geometry_data.get("LineSWEREF99TM")

                        if wkt_geometry_point or wkt_geometry_line:
                             coordinates = extract_coordinates_from_wkt(wkt_geometry_point or wkt_geometry_line)
                        else:
                             # Logga Geometry-objektet om det finns men saknar förväntade nycklar
                             current_app.logger.warning(f"Geometry object found for deviation {dev.get('Id')} but missing PointSWEREF99TM or LineSWEREF99TM. Geometry data: {geometry_data}")


                    if coordinates:
                        dev["WGS84Coordinates"] = coordinates
                        # Lägg till den bearbetade avvikelsen
                        processed_deviations.append(dev)
                    else:
                         # Logga varning om Geometry saknades helt eller om koordinater inte kunde extraheras
                         current_app.logger.warning(f"Could not process geometry for deviation: {dev.get('Id')}. Geometry data present: {bool(geometry_data)}. Coordinates extracted: {bool(coordinates)}")


                 # Lägg bara till situationen om den innehåller bearbetade avvikelser med koordinater
                 if processed_deviations:
                    # Uppdatera Deviation med bearbetade avvikelser
                    # Lägg till länsnamnet baserat på CountyNo för enklare användning i frontend
                    for p_dev in processed_deviations:
                         # CountyNo är en lista, ta det första elementet för uppslagning
                         county_number = p_dev.get("CountyNo", [None])[0]
                         p_dev["CountyName"] = COUNTY_NUMBER_TO_NAME.get(county_number, f"Okänt län ({county_number})")

                    situation["Deviation"] = processed_deviations
                    processed_situations.append(situation)
            else:
                 # Logga varning om Deviation saknas eller inte är en lista för en situation
                 current_app.logger.warning(f"Situation missing Deviation or Deviation is not a list: {situation.get('Id')}. Deviation type: {type(deviation_list)}")


        current_app.logger.debug(f"Returning {len(processed_situations)} processed situations with valid geometry.")
        # Returnera den bearbetade listan med situationer som har Deviation-objekt med koordinater
        return jsonify(processed_situations)

    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Error fetching data from Trafikverket: {e}")
        # Lägg till loggning av API-svarets text här
        if response is not None and response.text:
            current_app.logger.error(f"Trafikverket API response text: {response.text}")
        return jsonify({"error": f"Failed to fetch data from Trafikverket: {e}"}), 502  # Bad Gateway

    except (KeyError, IndexError, TypeError) as e:
        current_app.logger.error(f"Error parsing Trafikverket response: {e}")
        # Logga hela rådata-svaret för att underlätta felsökning av parsing-fel
        current_app.logger.debug(f"Trafikverket raw response: {response.text if response else 'No response'}")
        return jsonify({"error": f"Failed to parse data from Trafikverket: {e}"}), 500

    except Exception as e:  # Fånga andra oväntade fel
        current_app.logger.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500
