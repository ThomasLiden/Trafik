# traffic.py
from flask import Blueprint, jsonify, current_app, request
import requests
import os
from dotenv import load_dotenv
from pyproj import Transformer
from pyproj.exceptions import CRSError
import re
import logging

# Ladda miljövariabler om de inte redan är laddade globalt i app.py
load_dotenv()

traffic_blueprint = Blueprint('traffic', __name__)

# Konfigurera loggning
logging.basicConfig(level=logging.DEBUG)

TRAFIKVERKET_API_KEY = os.getenv("TRAFIKVERKET_API_KEY")
TRAFIKVERKET_API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"

try:
    transformer_sweref_to_wgs84 = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)
except CRSError as e:
    logging.error(f"Could not create pyproj Transformer: {e}")
    transformer_sweref_to_wgs84 = None

COUNTY_NAME_TO_NUMBER = {
    'Blekinge': 10, 'Dalarna': 20, 'Gotland': 9, 'Gävleborg': 21,
    'Halland': 13, 'Jämtland': 23, 'Jönköping': 6, 'Kalmar': 8,
    'Kronoberg': 7, 'Norrbotten': 25, 'Skåne': 12, 'Stockholm': 1,
    'Södermanland': 4, 'Uppsala': 3, 'Värmland': 17, 'Västerbotten': 24,
    'Västernorrland': 22, 'Västmanland': 19, 'Västra Götaland': 14,
    'Örebro': 18, 'Östergötland': 5
}

COUNTY_NUMBER_TO_NAME = {v: k for k, v in COUNTY_NAME_TO_NUMBER.items()}

logging.info("✅ traffic.py är laddad!")

def parse_wgs84_point(wkt_string):
    if not wkt_string or not isinstance(wkt_string, str):
        logging.warning(f"Invalid WGS84 input (not a string or empty): {wkt_string}")
        return None
    match = re.search(r'POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)', wkt_string.strip(), re.IGNORECASE)
    if match:
        try:
            lon = float(match.group(1))
            lat = float(match.group(2))
            return [lat, lon]
        except ValueError:
            logging.warning(f"Could not convert WGS84 POINT coordinates to float: {wkt_string}")
            return None
        except Exception as e:
            logging.error(f"Unexpected error parsing WGS84 POINT {wkt_string}: {e}")
            return None
    else:
        logging.warning(f"WGS84 POINT WKT string did not match expected format: {wkt_string}")
        return None

def parse_sweref99tm_geometry(wkt_string):
    if not transformer_sweref_to_wgs84:
        logging.error("SWEREF99TM Transformer not available.")
        return None
    if not wkt_string or not isinstance(wkt_string, str):
        logging.warning(f"Invalid SWEREF99TM input (not a string or empty): {wkt_string}")
        return None

    wkt_upper = wkt_string.strip().upper()
    try:
        if wkt_upper.startswith("POINT"):
            match = re.search(r'POINT\s*\(\s*(\d+\.?\d*)\s+(\d+\.?\d*)\s*\)', wkt_string, re.IGNORECASE)
            if match:
                y_sweref = float(match.group(1))
                x_sweref = float(match.group(2))
                lon, lat = transformer_sweref_to_wgs84.transform(x_sweref, y_sweref)
                return [lat, lon]
            else:
                logging.warning(f"SWEREF99TM POINT WKT string did not match expected format: {wkt_string}")
                return None
        elif wkt_upper.startswith("LINESTRING"):
            match = re.search(r'(\d+\.?\d*)\s+(\d+\.?\d*)', wkt_string)
            if match:
                y_sweref = float(match.group(1))
                x_sweref = float(match.group(2))
                lon, lat = transformer_sweref_to_wgs84.transform(x_sweref, y_sweref)
                return [lat, lon]
            else:
                logging.warning(f"Could not extract coordinates from SWEREF99TM LINESTRING: {wkt_string}")
                return None
        else:
            logging.warning(f"Unsupported SWEREF99TM geometry type or format: {wkt_string}")
            return None
    except ValueError:
        logging.warning(f"Could not convert SWEREF99TM coordinates to float: {wkt_string}")
        return None
    except Exception as e:
        logging.error(f"Error transforming SWEREF99TM coordinates {wkt_string}: {e}")
        return None

@traffic_blueprint.route('/api/traffic-situations', methods=['GET'])
def get_traffic_situations():
    if not TRAFIKVERKET_API_KEY:
        logging.error("Trafikverket API key not configured.")
        return jsonify({"error": "Server configuration error"}), 500

    county_name_filter = request.args.get('county')
    county_number_filter = COUNTY_NAME_TO_NUMBER.get(county_name_filter) if county_name_filter else None
    message_type_value_filter = request.args.get('messageTypeValue')

    filter_elements = []

    if county_number_filter is not None:
        filter_elements.append(f'<EQ name="Deviation.CountyNo" value="{county_number_filter}" />')
        logging.debug(f"Attempting to filter by County Number: {county_number_filter} ({county_name_filter})")

    if message_type_value_filter:
        message_types = [mt.strip() for mt in message_type_value_filter.split(',') if mt.strip()]
        if message_types:
            if len(message_types) == 1:
                filter_elements.append(f'<EQ name="Deviation.MessageTypeValue" value="{message_types[0]}" />')
                logging.debug(f"Filtering by single MessageTypeValue: {message_types[0]}")
            else:
                in_value_string = ','.join(message_types)
                filter_elements.append(f'<IN name="Deviation.MessageTypeValue" value="{in_value_string}" />')
                logging.debug(f"Filtering by multiple MessageTypeValues: {in_value_string}")

    filter_xml = "<AND>\n  <EXISTS name=\"Deviation\" value=\"true\" />"
    if filter_elements:
        filter_xml += "\n" + "\n".join(["  " + fe for fe in filter_elements])
    filter_xml += "\n</AND>"

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
        <INCLUDE>Deviation.Geometry.WGS84</INCLUDE>
        <INCLUDE>Deviation.Geometry.SWEREF99TM</INCLUDE>
        <INCLUDE>Deviation.LocationDescriptor</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.RoadName</INCLUDE>
        <INCLUDE>Deviation.PositionalDescription</INCLUDE>
        <INCLUDE>Deviation.MessageType</INCLUDE>
        <INCLUDE>Deviation.MessageTypeValue</INCLUDE>
        <INCLUDE>Deviation.IconId</INCLUDE>
    </QUERY>
</REQUEST>
"""

    try:
        response = requests.post(TRAFIKVERKET_API_URL, data=xml_query.encode('utf-8'), headers={'Content-Type': 'text/xml'})
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        logging.error(f"Error fetching data from Trafikverket: {e}")
        return jsonify({"error": "Failed to fetch traffic data"}), 500
