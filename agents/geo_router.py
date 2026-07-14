import json
import requests
import os
from shapely.geometry import Point, shape

with open('blr_wards.geojson', 'r') as f:
    WARD_DATA = json.load(f)

def get_ward(lat: float, lng: float) -> str:
    """Map GPS coordinates to BBMP ward name"""
    try:
        # First try point-in-polygon
        point = Point(lng, lat)
        for feature in WARD_DATA['features']:
            if shape(feature['geometry']).contains(point):
                return feature['properties']['KGISWardName']

        # Fallback — use Google Geocoding to get area name
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={api_key}"
        response = requests.get(url)
        data = response.json()

        if data['results']:
            # Extract sublocality or locality from Google response
            for result in data['results']:
                for component in result['address_components']:
                    if 'sublocality' in component['types']:
                        area = component['long_name']
                        return f"{area}, Bengaluru"

        return "Bengaluru (Ward TBD)"

    except Exception as e:
        print(f"Geo router error: {e}")
        return "Bengaluru (Ward TBD)"