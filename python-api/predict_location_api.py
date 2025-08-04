import os
import json
import glob
import traceback
import pandas as pd
import numpy as np
from joblib import load
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from scipy.spatial import cKDTree
import math
import random

# =============================================================================
# 1. GLOBAL SETUP
# =============================================================================
print("🚀 Starting API setup...")
base_path = os.path.dirname(__file__)

try:
    model_path = os.path.join(base_path, 'store_placement_model.joblib')
    columns_path = os.path.join(base_path, 'feature_columns.joblib')
    model = load(model_path)
    feature_columns = load(columns_path)
    print("✅ Model and feature columns loaded successfully.")
except Exception as e:
    print(f"❌ CRITICAL ERROR: Could not load model files. {e}")
    model = None
    feature_columns = None

def load_and_process_geojson(file_path):
    data = []
    if not os.path.exists(file_path): return pd.DataFrame(data)
    try:
        with open(file_path, 'r', encoding='utf-8') as f: geojson_data = json.load(f)
    except json.JSONDecodeError: return pd.DataFrame(data)

    for feature in geojson_data.get('features', []):
        props = feature.get('properties', {})
        geom = feature.get('geometry', {})
        if not geom or 'type' not in geom or 'coordinates' not in geom or not geom['coordinates']: continue
        try:
            coords_list = geom['coordinates']
            if geom['type'] == 'Point':
                lon, lat = coords_list[:2]
            elif geom['type'] in ['Polygon', 'LineString', 'MultiPolygon', 'MultiLineString']:
                while isinstance(coords_list[0][0], list): coords_list = coords_list[0]
                if not coords_list: continue
                lons = [c[0] for c in coords_list if isinstance(c, list) and len(c) >= 2]
                lats = [c[1] for c in coords_list if isinstance(c, list) and len(c) >= 2]
                if not lons or not lats: continue
                lon, lat = sum(lons) / len(lons), sum(lats) / len(lats)
            else: continue
            data.append({
                'latitude': lat, 'longitude': lon,
                'fclass': props.get('fclass', props.get('class', 'unknown')),
                'name': props.get('name', ''),
                'landuse': props.get('landuse', ''), 'place': props.get('place', ''),
            })
        except (IndexError, TypeError, ZeroDivisionError): continue
    return pd.DataFrame(data)

# --- Data loading limited to South India region ---
print("📂 Loading geospatial data for the 'south' zone to conserve memory...")
data_path = os.path.join(base_path, 'ml')

south_places_files = [
    os.path.join(data_path, 'south_points_places.geojson'),
    os.path.join(data_path, 'north_pois.geojson'), 
    os.path.join(data_path, 'west_pois.geojson'),
    os.path.join(data_path, 'center_pois.geojson')
]
south_waters_files = [ os.path.join(data_path, 'south_points_waters.geojson') ]
south_landuse_files = [ os.path.join(data_path, 'south_landuse.geojson') ]

places_dfs = [load_and_process_geojson(f) for f in south_places_files]
pois_dfs = places_dfs 
waters_dfs = [load_and_process_geojson(f) for f in south_waters_files]
landuse_dfs = [load_and_process_geojson(f) for f in south_landuse_files]

places_df = pd.concat(places_dfs, ignore_index=True).drop_duplicates(subset=['latitude', 'longitude']).reset_index(drop=True) if places_dfs else pd.DataFrame()
pois_df = pd.concat(pois_dfs, ignore_index=True).drop_duplicates(subset=['latitude', 'longitude']).reset_index(drop=True) if pois_dfs else pd.DataFrame()
waters_df = pd.concat(waters_dfs, ignore_index=True).drop_duplicates(subset=['latitude', 'longitude']).reset_index(drop=True) if waters_dfs else pd.DataFrame()
landuse_df = pd.concat(landuse_dfs, ignore_index=True).drop_duplicates(subset=['latitude', 'longitude']).reset_index(drop=True) if landuse_dfs else pd.DataFrame()

print(f"  - Places & POIs: {len(places_df)}, Waters: {len(waters_df)}, Landuse: {len(landuse_df)}")

print("🔍 Building spatial indices...")
places_tree = cKDTree(places_df[['latitude', 'longitude']]) if not places_df.empty else None
pois_tree = cKDTree(pois_df[['latitude', 'longitude']]) if not pois_df.empty else None
waters_tree = cKDTree(waters_df[['latitude', 'longitude']]) if not waters_df.empty else None
landuse_tree = cKDTree(landuse_df[['latitude', 'longitude']]) if not landuse_df.empty else None
print("✅ Spatial indices built.")


# =============================================================================
# 2. FEATURE ENGINEERING & PREDICTION LOGIC
# =============================================================================

# --- Helper functions for feature calculation ---
def calculate_distance_to_nearest(lat, lon, tree):
    if tree is None: return 999.0
    dist, _ = tree.query([[lat, lon]], k=1)
    return dist[0] * 111.0

def count_features_within_radius(lat, lon, tree, radius_km=0.5):
    if tree is None: return 0
    radius_deg = radius_km / 111.0
    indices = tree.query_ball_point([lat, lon], r=radius_deg)
    return len(indices)

def get_landuse_at_point(lat, lon):
    if landuse_tree is None or landuse_df.empty: return 'unknown'
    dist, idx = landuse_tree.query([[lat, lon]], k=1)
    if dist[0] * 111.0 <= 1.0:
        feature = landuse_df.iloc[idx[0]]
        return feature.get('fclass', feature.get('landuse', 'unknown'))
    return 'unknown'

def get_nearest_place_name(lat, lon):
    if places_tree is None or places_df.empty: return "Unknown Area"
    dist, idx = places_tree.query([[lat, lon]], k=1)
    if dist[0] * 111.0 <= 2.0:
        place_name = places_df.iloc[idx[0]]['name']
        return place_name if place_name and str(place_name).strip() else "Unnamed Place"
    return "Open Area"

# --- Main feature creation function ---
def create_features_for_locations(locations_df: pd.DataFrame) -> pd.DataFrame:
    feature_list = []
    for _, row in locations_df.iterrows():
        lat, lon = row['latitude'], row['longitude']
        dist_place = calculate_distance_to_nearest(lat, lon, places_tree)
        features = {
            'latitude': lat, 'longitude': lon,
            'fclass': row.get('fclass', 'unknown'),
            'landuse_type': get_landuse_at_point(lat, lon),
            'dist_to_nearest_place': dist_place,
            'dist_to_nearest_poi': calculate_distance_to_nearest(lat, lon, pois_tree),
            'dist_to_nearest_water': calculate_distance_to_nearest(lat, lon, waters_tree),
            'poi_count_500m': count_features_within_radius(lat, lon, pois_tree, 0.5),
            'poi_count_1km': count_features_within_radius(lat, lon, pois_tree, 1.0),
            'place_count_1km': count_features_within_radius(lat, lon, places_tree, 1.0),
            'near_settlement': dist_place <= 2.0
        }
        feature_list.append(features)
    return pd.DataFrame(feature_list)

# --- Main prediction logic function ---
def predict_locations_logic(input_df: pd.DataFrame):
    if model is None: raise HTTPException(status_code=500, detail="Model not loaded.")
    features_df = create_features_for_locations(input_df)
    X_processed = pd.get_dummies(features_df, columns=['fclass', 'landuse_type'])
    X_aligned = X_processed.reindex(columns=feature_columns, fill_value=0)
    predictions = model.predict(X_aligned)
    probabilities = model.predict_proba(X_aligned)
    results = []
    for i, row in input_df.iterrows():
        place_name = get_nearest_place_name(row['latitude'], row['longitude'])
        results.append({
            "latitude": row['latitude'], "longitude": row['longitude'],
            "suitable": bool(predictions[i]),
            "confidence": round(float(probabilities[i][1]), 3),
            "place_name": place_name
        })
    print("✅ Prediction logic completed successfully.")
    return results

# =============================================================================
# 3. FASTAPI APP AND ENDPOINTS
# =============================================================================
app = FastAPI(title="Store Placement Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

class CircleRequest(BaseModel):
    latitude: float
    longitude: float
    radius: float
    fclass: str = "open_land"

def generate_points_in_circle(center_lat, center_lng, radius_km, num_points=20):
    points = []
    for _ in range(num_points):
        angle = random.uniform(0, 2 * math.pi)
        r = radius_km * math.sqrt(random.uniform(0, 1))
        lat_offset = r * math.cos(angle) / 110.574
        lng_offset = r * math.sin(angle) / (111.320 * math.cos(math.radians(center_lat)))
        points.append({'latitude': center_lat + lat_offset, 'longitude': center_lng + lng_offset})
    return points

@app.post("/predict-circle")
def predict_circle(request: CircleRequest):
    try:
        print(f"\nReceived /predict-circle request for lat:{request.latitude}, lon:{request.longitude}, rad:{request.radius}")
        points = generate_points_in_circle(request.latitude, request.longitude, request.radius)
        input_df = pd.DataFrame(points)
        input_df['fclass'] = request.fclass
        return predict_locations_logic(input_df)
    except Exception as e:
        print(f"❌ ERROR in /predict-circle endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")

@app.get("/")
def root():
    return {"message": "Store Placement Prediction API is running 🚀"}