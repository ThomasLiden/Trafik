# traffic.py
import os
import logging
from flask import Blueprint, jsonify, request
import requests
from dotenv import load_dotenv
from pyproj import Transformer
from pyproj.exceptions import CRSError
import re

# Ladda miljövariabler
load_dotenv()

traffic_blueprint = Blueprint('traffic', __name__)

# Konfigurera loggning
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

TRAFIKVERKET_API_KEY = os.getenv("TRAFIKVERKET_API_KEY")
TRAFIKVERKET_API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"

# Transformer
try:
    transformer_sweref_to_wgs84 = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)
except CRSError as e:
    logging.error(f"Could not create pyproj Transformer: {e}")
    transformer_sweref_to_wgs84 = None

# Mappings
COUNTY_NAME_TO_NUMBER = {
    'Blekinge': 10, 'Dalarna': 20, 'Gotland': 9, 'Gävleborg': 21,
    'Halland': 13, 'Jämtland': 23, 'Jönköping': 6, 'Kalmar': 8,
    'Kronoberg': 7, 'Norrbotten': 25, 'Skåne': 12, 'Stockholm': 1,
    'Södermanland': 4, 'Uppsala': 3, 'Värmland': 17, 'Västerbotten': 24,
    'Västernorrland': 22, 'Västmanland': 19, 'Västra Götaland': 14,
    'Örebro': 18, 'Östergötland': 5
}
COUNTY_NUMBER_TO_NAME = {v: k for k, v in COUNTY_NAME_TO_NUMBER.items()}

logging.info("✅ traffic.py loaded!")

# Helper funktioner (parse_wgs84_point, parse_sweref99tm_geometry)

def parse_wgs84_point(wkt_string):
    if not wkt_string or not isinstance(wkt_string, str):
        return None
    match = re.search(r'POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)', wkt_string.strip(), re.IGNORECASE)
    if match:
        try:
            lon = float(match.group(1))
            lat = float(match.group(2))
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return [lat, lon] # Leaflet behöver [lat, lon]
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
        # Logga bara om strängen faktiskt innehåller något men inte matchar
        if wkt_string.strip() and not wkt_string.strip().upper().startswith("POINT"):
            logging.warning(f"WGS84 WKT string did not match expected POINT format: {wkt_string}")
        return None

# --- Endpoint för trafikinformation ---
@traffic_blueprint.route('/api/traffic-info', methods=['GET'])
def get_traffic_info():
    if not TRAFIKVERKET_API_KEY:
        logging.error("Trafikverket API key not configured.")
        return jsonify({"error": "Server configuration error"}), 500

    county_name_filter = request.args.get('county')
    county_number_filter = COUNTY_NAME_TO_NUMBER.get(county_name_filter) if county_name_filter else None
    message_type_value_filter = request.args.get('messageTypeValue', 'Accident,Roadwork')

    # --- Bygg filter för Situation Query ---
    situation_filter_elements = []
    if county_number_filter is not None:
        situation_filter_elements.append(f'<EQ name="Deviation.CountyNo" value="{county_number_filter}" />')
    if message_type_value_filter:
        message_types = [mt.strip() for mt in message_type_value_filter.split(',') if mt.strip()]
        if message_types:
            in_value_string = ','.join(message_types)
            situation_filter_elements.append(f'<IN name="Deviation.MessageTypeValue" value="{in_value_string}" />')

    # Grundfilter
    situation_filter_xml = "<AND>\n    <EXISTS name=\"Deviation\" value=\"true\" />"
    if situation_filter_elements:
        situation_filter_xml += "\n" + "\n".join(["    " + fe for fe in situation_filter_elements])
    situation_filter_xml += "\n  </AND>"

    # --- Bygg filter för BÅDA Camera Queries ---
    trafficsafetycamera_filter_xml = ""
    if county_number_filter is not None:
         trafficsafetycamera_filter_xml = f'<FILTER>\n    <EQ name="CountyNo" value="{county_number_filter}" />\n  </FILTER>'
    else:
         trafficsafetycamera_filter_xml = "<FILTER />"

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
    <INCLUDE>Deviation.Geometry.WGS84</INCLUDE>
    <INCLUDE>Deviation.Geometry.SWEREF99TM</INCLUDE>
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
        response = requests.post(
            TRAFIKVERKET_API_URL,
            data=xml_query.encode('utf-8'),
            headers={'Content-Type': 'text/xml'}
        )
        response.raise_for_status()
        logging.info(f"Successfully fetched data (Extended Situation, Basic TrafficSafetyCamera) from Trafikverket.")
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        err_msg = f"Error fetching data from Trafikverket: {e}"
        status_code = e.response.status_code if e.response is not None else "N/A"
        resp_text = e.response.text if e.response is not None else "No response body"
        logging.error(f"{err_msg} - Status: {status_code} - Response: {resp_text[:500]}")
        return jsonify({"error": "Failed to fetch traffic data from Trafikverket API."}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred in get_traffic_info: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred."}), 500
