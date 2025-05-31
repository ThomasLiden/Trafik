# routes/trafikverket_proxy.py
from flask import Blueprint, request, jsonify
import os
import requests

trafikverket_proxy = Blueprint("trafikverket_proxy", __name__)

TRV_API_KEY = os.getenv("TRV_API_KEY")
TRV_API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"

@trafikverket_proxy.route("/trafikinfo")
def trafikinfo():
    county = request.args.get("county")  # t.ex. 24
    xml_payload = f"""
    <REQUEST>
      <LOGIN authenticationkey="{TRV_API_KEY}" />
      <QUERY objecttype="Situation" schemaversion="1.5">
        <FILTER>
          <GT name="Deviation.StartTime" value="$dateadd(-1.00:00:00)" />
        </FILTER>
        <INCLUDE>Deviation.Id</INCLUDE>
        <INCLUDE>Deviation.Header</INCLUDE>
        <INCLUDE>Deviation.Message</INCLUDE>
        <INCLUDE>Deviation.CountyNo</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.RoadName</INCLUDE>
        <INCLUDE>Deviation.MessageTypeValue</INCLUDE>
        <INCLUDE>Deviation.Geometry.WGS84</INCLUDE>
      </QUERY>
    </REQUEST>
    """.strip()

    try:
        res = requests.post(TRV_API_URL, data=xml_payload, headers={"Content-Type": "application/xml"})
        res.raise_for_status()
        result = res.json()

        deviations = []
        for r in result.get("RESPONSE", {}).get("RESULT", []):
            for situation in r.get("Situation", []):
                for deviation in situation.get("Deviation", []):
                    if not county or str(county) in map(str, deviation.get("CountyNo", [])):
                        deviations.append(deviation)

        return jsonify(deviations[:10])  # returnera max 10
    except Exception as e:
        print("❌ Trafikverket proxy error:", e)
        return jsonify({"error": "Fel vid hämtning", "details": str(e)}), 500