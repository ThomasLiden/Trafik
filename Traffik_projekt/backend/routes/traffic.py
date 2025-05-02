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

# Skapa en Transformer för att konvertera från SWEREF99TM (EPSG:3006) till WGS84 (EPSG:4326)
# always_xy=True säkerställer att transform.transform alltid tar (x, y) som indata,
# oavsett standardordningen för CRS:et.
# För SWEREF99TM (EPSG:3006) är standardordningen (Y, X). Vi måste därför skicka X (Easting)
# som första parameter och Y (Northing) som andra parameter till transformer.transform.
# För WGS84 (EPSG:4326) är standardordningen (Lat, Lon). Men API:et returnerar WGS84 WKT
# i formatet POINT(Lon Lat). Vi kommer att parsa detta direkt utan pyproj-transformern.
transformer = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)

# Mappning från länsnamn (som används i frontend) till länsnummer (som används i Trafikverkets API)
COUNTY_NAME_TO_NUMBER = {
    'Blekinge': 10, 'Dalarna': 20, 'Gotland': 9, 'Gävleborg': 21,
    'Halland': 13, 'Jämtland': 23, 'Jönköping': 6, 'Kalmar': 8,
    'Kronoberg': 7, 'Norrbotten': 25, 'Skåne': 12, 'Stockholm': 1,
    'Södermanland': 4, 'Uppsala': 3, 'Värmland': 17, 'Västerbotten': 24,
    'Västernorrland': 22, 'Västmanland': 19, 'Västra Götaland': 14,
    'Örebro': 18, 'Östergötland': 5
}

# Mappning från länsnummer till länsnamn för att visa i frontend (popup)
COUNTY_NUMBER_TO_NAME = {v: k for k, v in COUNTY_NAME_TO_NUMBER.items()}


print("✅ traffic.py är laddad!")

def parse_wgs84_point(wkt_string):
    """
    Extraherar koordinater (lon, lat) från en WGS84 POINT WKT-sträng.
    Format: POINT(Lon Lat)
    Returnerar [lat, lon] för Leaflet.
    """
    if not wkt_string or not isinstance(wkt_string, str) or not wkt_string.upper().startswith("POINT("):
        return None
    
    # Använd re.search för att hitta de två numeriska värdena inom parentesen
    # Tillåter siffror, punkt, och eventuellt minustecken
    match = re.search(r'POINT\((-?\d+\.?\d*) (-?\d+\.?\d*)\)', wkt_string)
    if match:
        try:
            # WGS84 WKT format is POINT(Lon Lat)
            lon = float(match.group(1)) # First number is Longitude
            lat = float(match.group(2)) # Second number is Latitude
            # Return [lat, lon] as expected by Leaflet
            return [lat, lon]
        except ValueError:
            current_app.logger.warning(f"Could not convert WGS84 POINT coordinates to float: {wkt_string}")
            return None
    current_app.logger.warning(f"WGS84 POINT WKT string did not match expected format: {wkt_string}")
    return None

def parse_sweref99tm_geometry(wkt_string):
    """
    Extraherar koordinater från en SWEREF99TM WKT-sträng (POINT eller LINESTRING)
    och konverterar till WGS84 [lat, lon].
    SWEREF99TM WKT format: POINT(Y X) or LINESTRING(Y1 X1, Y2 X2, ...)
    Returnerar [lat, lon] för POINT eller den första punkten [lat, lon] för LINESTRING.
    """
    if not wkt_string or not isinstance(wkt_string, str):
        return None

    # SWEREF99TM WKT format is POINT(Y X) or LINESTRING(Y1 X1, Y2 X2, ...)
    # pyproj transformer with always_xy=True expects input as (X, Y)
    # We need to extract Y and X from the WKT and pass them to transform as (X, Y)

    if wkt_string.upper().startswith("POINT("):
        # Regex to find the two numbers inside POINT(...)
        match = re.search(r'POINT\((\d+\.?\d*) (\d+\.?\d*)\)', wkt_string)
        if match:
            try:
                y_sweref = float(match.group(1)) # First number in WKT is Y (Northing)
                x_sweref = float(match.group(2)) # Second number in WKT is X (Easting)
                # Transformerar från SWEREF99TM (X, Y) till WGS84 (Lon, Lat)
                # Skicka X_sweref som första parameter och Y_sweref som andra till transform.transform
                lon, lat = transformer.transform(x_sweref, y_sweref)
                # Return [lat, lon] as expected by Leaflet
                return [lat, lon]
            except ValueError:
                 current_app.logger.warning(f"Could not convert SWEREF99TM POINT coordinates to float: {wkt_string}")
                 return None
            except Exception as e: # Fånga fel från transformer.transform
                current_app.logger.error(f"Error transforming SWEREF99TM POINT coordinates {wkt_string}: {e}")
                return None

    elif wkt_string.upper().startswith("LINESTRING("):
        coordinates = []
        # Hitta alla koordinatpar (Y X) i LINESTRING
        # Notera: Regexen matchar bara par av positiva tal
        matches = re.findall(r'(\d+\.?\d*) (\d+\.?\d*)', wkt_string)
        for match in matches:
            try:
                y_sweref = float(match[0]) # First number is Y (Northing)
                x_sweref = float(match[1]) # Second number is X (Easting)
                # Transformerar varje punkt (X, Y) -> (Lon, Lat)
                lon, lat = transformer.transform(x_sweref, y_sweref)
                coordinates.append([lat, lon])
            except ValueError:
                 current_app.logger.warning(f"Could not convert one pair of SWEREF99TM LINESTRING coordinates to float: {match}")
                 continue # Skip this pair but continue with others
            except Exception as e:
                 current_app.logger.error(f"Error transforming one pair of SWEREF99TM LINESTRING coordinates {match} from {wkt_string}: {e}")
                 continue # Skip this pair but continue with others

        # Returnera den första punkten [lat, lon] för enkel markering
        return coordinates[0] if coordinates else None
    
    current_app.logger.warning(f"SWEREF99TM WKT string did not match expected format: {wkt_string}")
    return None # Returnera None om WKT-strängen inte matchas eller är tom


@traffic_blueprint.route('/api/traffic-situations', methods=['GET'])
def get_traffic_situations():
    """
    Hämtar trafiksituationer från Trafikverkets API, filtrerar på län och meddelandetyp,
    konverterar koordinater (prioriterar WGS84 om det finns) och returnerar som JSON.
    """
    if not TRAFIKVERKET_API_KEY:
        current_app.logger.error("Trafikverket API key not configured.")
        # Bättre att returnera 500 fel här
        return jsonify({"error": "Trafikverket API key not configured"}), 500

    # Hämta filter från request-parametrar
    # Frontend skickar länsnamnet, vi konverterar till länsnummer för API:et
    county_name_filter = request.args.get('county')
    # Hitta länsnumret baserat på länsnamnet från frontend
    county_number_filter = None
    if county_name_filter in COUNTY_NAME_TO_NUMBER:
        county_number_filter = COUNTY_NAME_TO_NUMBER[county_name_filter]


    # Frontend skickar messageTypeValue (t.ex. 'Accident' eller 'Roadwork')
    # Kan vara en komma-separerad sträng om flera typer, t.ex. 'Accident,Roadwork'
    message_type_value_filter = request.args.get('messageTypeValue')

    # Bygg upp FILTER-delen av XML-frågan baserat på inkommande parametrar
    filter_elements = [] # Starta med en tom lista

    # Lägg till filter för länsnummer om ett län valts i frontend
    if county_number_filter is not None:
        # Använd <IN> för att filtrera på värden i en lista (Deviation.CountyNo är int[])
        # Skicka värdet som en enkel sträng utan extra kommatecken
        # Notera: Trafikverket API stöder INTE att skicka flera CountyNo i en IN-sats i schemaversion 1.5 för Situation.
        # Om du vill filtrera på flera län samtidigt, måste du göra ETT API-anrop PER län från backend.
        # Nuvarande frontend skickar bara ETT län (eller inget).
        filter_elements.append(f'<IN name="Deviation.CountyNo" value="{county_number_filter}" />')
        current_app.logger.debug(f"Filtering by County Number: {county_number_filter} ({county_name_filter}) using IN on CountyNo.")

    # Lägg till filter för meddelandetypvärde om det finns i requesten
    if message_type_value_filter:
        # Frontend skickar en komma-separerad sträng om flera typer, t.ex. 'Accident,Roadwork'
        # Trafikverket API schema 1.5 för Situation.MessageTypeValue stöder EQ (exakt matchning)
        # eller IN (matcha mot en lista av värden).
        # Om frontend skickar 'Accident,Roadwork', behöver vi omvandla det till en IN-sats.
        message_types = [mt.strip() for mt in message_type_value_filter.split(',') if mt.strip()]
        if message_types:
            if len(message_types) == 1:
                # Om bara en typ, använd EQ
                filter_elements.append(f'<EQ name="Deviation.MessageTypeValue" value="{message_types[0]}" />')
                current_app.logger.debug(f"Filtering by MessageTypeValue: {message_types[0]} using EQ.")
            else:
                # Om flera typer, använd IN med flera värden (komma-separerad sträng)
                # Rätt format verkar vara value="Value1,Value2,..."
                # in_value_string = '","'.join(message_types) # GAMMAL: Skapar "Accident","Roadwork"
                in_value_string = ','.join(message_types) # NY: Skapar "Accident,Roadwork"
                filter_elements.append(f'<IN name="Deviation.MessageTypeValue" value="{in_value_string}" />')
                current_app.logger.debug(f"Filtering by MessageTypeValues: {message_types} using IN. Generated value: {in_value_string}") # Lägg till loggning för att se den genererade strängen



    # Alla filterelement måste ligga inom en <AND> sats tillsammans med <EXISTS name="Deviation" value="true">
    # för att säkerställa att Deviation-objektet finns i svaret.
    filter_xml = "<AND>\n" + '  <EXISTS name="Deviation" value="true" />' # Starta AND med EXISTS och indrag
    if filter_elements:
        # Lägg till övriga filter med indrag
        filter_xml += "\n" + "\n".join(["  " + fe for fe in filter_elements])
    filter_xml += "\n</AND>"


    # Definiera XML-frågan till Trafikverkets API
    # Inkludera nödvändiga fält, inklusive Geometry.SWEREF99TM, Geometry.WGS84, Deviation.CountyNo och Deviation.MessageTypeValue
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
    response = None # Initiera response för att säkerställa att den finns i error-hanteringen

    try:
        current_app.logger.debug(f"Sending XML query to Trafikverket:\n{xml_query}")
        response = requests.post(TRAFIKVERKET_API_URL, data=xml_query.encode('utf-8'), headers=headers)
        response.raise_for_status()  # Kasta ett undantag för dåliga svar (4xx eller 5xx)

        data = response.json()

        # Kontrollera om sökvägen till situationer är giltig
        situations_result = data.get("RESPONSE", {}).get("RESULT", [])
        if not situations_result:
             current_app.logger.warning("No RESULT found or RESULT is empty in Trafikverket response.")
             return jsonify([]), 200 # Returnera tom lista om inget RESULT finns

        # Antag att situationerna finns i det första RESULT-objektet och att det finns Deviation-objekt inuti
        # API:et returnerar en lista med Situation-objekt under RESULT[0]['Situation'].
        # Varje Situation-objekt kan ha en lista med Deviation-objekt.
        # Vi loopar igenom Situation-objekten och samlar alla Deviation-objekt som har geometri.
        all_deviations_with_geometry = []

        for result_item in situations_result: # Gå igenom varje objekt under RESULT
             situations_in_result = result_item.get("Situation", []) # Hämta listan av Situationer
             for situation in situations_in_result:
                 deviation_list = situation.get("Deviation") # Hämta listan av Deviations för denna Situation
                 # Kontrollera att Deviation existerar och är en lista
                 if deviation_list and isinstance(deviation_list, list):
                      for dev in deviation_list:
                         geometry_data = dev.get("Geometry")
                         coordinates = None

                         if geometry_data:
                             # --- Prioritera WGS84 om det finns ---
                             wgs84_geometry = geometry_data.get("WGS84") # Detta fält har vi inkluderat!
                             if wgs84_geometry:
                                 coordinates = parse_wgs84_point(wgs84_geometry)
                                 if coordinates:
                                     current_app.logger.debug(f"Used WGS84 geometry for deviation {dev.get('Id')}")

                             # --- Om WGS84 saknas eller inte kunde parsas, försök med SWEREF99TM ---
                             if not coordinates:
                                 sweref_point = geometry_data.get("PointSWEREF99TM")
                                 sweref_line = geometry_data.get("LineSWEREF99TM")
                                 if sweref_point or sweref_line:
                                     # Skicka hela WKT-strängen till parsningsfunktionen
                                     coordinates = parse_sweref99tm_geometry(sweref_point or sweref_line)
                                     if coordinates:
                                         current_app.logger.debug(f"Used SWEREF99TM geometry for deviation {dev.get('Id')}")


                         # Om koordinater kunde extraheras från någon källa
                         if coordinates:
                            # Lägg till WGS84Coordinates fältet för frontend
                            dev["WGS84Coordinates"] = coordinates
                            # Lägg till länsnamnet baserat på CountyNo för enklare användning i frontend
                            # CountyNo är en lista, ta det första elementet för uppslagning
                            county_number = dev.get("CountyNo", [None])[0] # Använd [None] som default för att undvika IndexError
                            dev["CountyName"] = COUNTY_NUMBER_TO_NAME.get(county_number, f"Okänt län ({county_number})")

                            # Lägg till denna bearbetade avvikelse till den globala listan
                            all_deviations_with_geometry.append(dev)

                         else:
                              # Logga varning om Geometry saknades helt eller om koordinater inte kunde extraheras
                              # Detta är ok om vissa händelser inte har koordinater (t.ex. textbaserade)
                              geometry_fields_present = bool(geometry_data and (geometry_data.get("WGS84") or geometry_data.get("PointSWEREF99TM") or geometry_data.get("LineSWEREF99TM")))
                              current_app.logger.warning(f"Could not extract usable geometry for deviation: {dev.get('Id')}. Geometry object present: {bool(geometry_data)}. Geometry fields present: {geometry_fields_present}. WGS84 parsed: {bool(coordinates if geometry_data and geometry_data.get('WGS84') else False)}. SWEREF99TM parsed: {bool(coordinates if geometry_data and (geometry_data.get('PointSWEREF99TM') or geometry_data.get('LineSWEREF99TM')) else False)}")

                 else:
                      # Logga varning om Deviation saknas eller inte är en lista för en Situation
                      current_app.logger.warning(f"Situation item missing Deviation or Deviation is not a list: {situation.get('Id')}. Deviation type: {type(deviation_list)}. Situation data: {situation}")


        # Returnera EN platt lista med alla bearbetade Deviations som hade koordinater
        current_app.logger.debug(f"Returning {len(all_deviations_with_geometry)} processed deviations with valid geometry.")
        return jsonify(all_deviations_with_geometry) # Returnera den platta listan


    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Error fetching data from Trafikverket: {e}")
        # Logga API-svarets text om det finns för felsökning
        if response is not None and hasattr(response, 'text') and response.text:
            current_app.logger.error(f"Trafikverket API response text: {response.text}")
        return jsonify({"error": f"Failed to fetch data from Trafikverket: {e}"}), 502  # Bad Gateway

    except (KeyError, IndexError, TypeError) as e:
        current_app.logger.error(f"Error parsing Trafikverket response: {e}")
        # Logga hela rådata-svaret vid parsing-fel
        # Försök få tag i svarstexten även om response är None eller saknar text
        raw_response_text = "No response or response text unavailable"
        if response is not None:
            try:
                raw_response_text = response.text
            except Exception:
                pass # Ignore if getting text fails

        current_app.logger.debug(f"Trafikverket raw response potentially causing parse error: {raw_response_text}")

        return jsonify({"error": f"Failed to parse data from Trafikverket: {e}"}), 500

    except Exception as e:  # Fånga andra oväntade fel
        current_app.logger.error(f"An unexpected error occurred: {e}")
        # Försök logga svarstexten även vid oväntade fel om möjligt
        raw_response_text = "No response or response text unavailable"
        if response is not None:
            try:
                raw_response_text = response.text
            except Exception:
                pass # Ignore if getting text fails
        current_app.logger.debug(f"Trafikverket raw response potentially related to unexpected error: {raw_response_text}")

        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500