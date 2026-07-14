import json
from shapely.geometry import Point, shape

# Load ward boundaries once at startup
with open('blr_wards.geojson', 'r') as f:
    WARD_DATA = json.load(f)

def get_ward(lat: float, lng: float) -> str:
    """Map GPS coordinates to BBMP ward name"""
    try:
        point = Point(lng, lat)
        for feature in WARD_DATA['features']:
            if shape(feature['geometry']).contains(point):
                return feature['properties']['KGISWardName']
        return "Unknown Ward"
    except Exception as e:
        print(f"Geo router error: {e}")
        return "Unknown Ward"