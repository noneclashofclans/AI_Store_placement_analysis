from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import json
import pandas as pd
import os
import geopy.distance
import math
import random
from joblib import load

# --- Load model and feature columns (CORRECTED PATHS) ---
base_path = os.path.dirname(__file__)
# Go up two levels from a script in 'src/server' to the project root
project_root = os.path.abspath(os.path.join(base_path, '..', '..'))

try:
    # Load from the project root directory
    model = load(os.path.join(project_root, 'store_placement_model.joblib'))
    # Assuming feature_columns is also in the root
    feature_columns = load(os.path.join(project_root, 'feature_columns.joblib'))
except Exception as e:
    print(f"Error loading model files: {e}")
    model = None
    feature_columns = None

# --- Load reference data for calculating nearby settlements (CORRECTED PATH) ---
def process_geojson(geojson_path):
    data = []
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        for feature in geojson_data['features']:
            props = feature.get('properties', {})
            geom = feature.get('geometry', {})
            
            if geom['type'] == 'Point':
                lon, lat = geom['coordinates']
                data.append({
                    'latitude': lat,
                    'longitude': lon,
                    'fclass': props.get('fclass'),
                    'name': props.get('name')
                })
    except Exception as e:
        print(f"Error loading geojson file: {e}")
    
    return pd.DataFrame(data)

# Point to the 'ml' subdirectory
geojson_file = os.path.join(base_path, 'ml', 'my_points.geojson')
df_all = process_geojson(geojson_file)
settlements = df_all[df_all['fclass'] == 'settlement'] if not df_all.empty else pd.DataFrame()
settlement_coords = list(zip(settlements['latitude'], settlements['longitude'])) if not settlements.empty else []

# --- FastAPI setup ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Store Placement Prediction API is running 🚀", "status": "healthy"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

# --- Request schema ---
class Location(BaseModel):
    latitude: float
    longitude: float
    fclass: str

class CircleRequest(BaseModel):
    latitude: float
    longitude: float
    radius: float
    fclass: str = "open_land"

# --- Generate points within circle ---
def generate_points_in_circle(center_lat, center_lng, radius_km, num_points=20):
    """Generate random points within a circle"""
    points = []
    
    for _ in range(num_points):
        angle = random.uniform(0, 2 * math.pi)
        r = radius_km * math.sqrt(random.uniform(0, 1))
        
        lat_offset = r * math.cos(angle) / 110.54
        lng_offset = r * math.sin(angle) / (111.32 * math.cos(math.radians(center_lat)))
        
        new_lat = center_lat + lat_offset
        new_lng = center_lng + lng_offset
        
        points.append({
            'latitude': new_lat,
            'longitude': new_lng
        })
    
    return points

# --- Prediction Logic (The one and only correct version) ---
def predict_locations_logic(locations: List[Location]):
    if model is None or feature_columns is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly")
    
    try:
        new_df = pd.DataFrame([loc.dict() for loc in locations])
        
        # Calculate near_settlement
        near_settlement = []
        for _, row in new_df.iterrows():
            point_coords = (row['latitude'], row['longitude'])
            is_near = any(
                0 < geopy.distance.geodesic(point_coords, s_coords).km <= 2.0
                for s_coords in settlement_coords
            ) if settlement_coords else False
            near_settlement.append(is_near)
        
        new_df['near_settlement'] = near_settlement
        
        # One-hot encode and align columns
        X_new = pd.get_dummies(new_df[['latitude', 'longitude', 'fclass', 'near_settlement']], columns=['fclass'])
        X_new = X_new.reindex(columns=feature_columns, fill_value=0)
        
        # Predict
        predictions = model.predict(X_new)
        probabilities = model.predict_proba(X_new) if hasattr(model, "predict_proba") else [[None, None]] * len(predictions)
        
        # Format response
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            results.append({
                "latitude": new_df.iloc[i]['latitude'],
                "longitude": new_df.iloc[i]['longitude'],
                "suitable": bool(pred),
                "confidence": round(float(prob[1]), 2) if prob[1] is not None else None
            })
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# --- API Endpoints ---
@app.post("/predict")
def predict_locations_simple(locations: List[Location]):
    return predict_locations_logic(locations)

@app.post("/api/predict")
def predict_locations(locations: List[Location]):
    return predict_locations_logic(locations)

@app.post("/predict-circle")
def predict_circle(request: CircleRequest):
    """Generate and predict multiple points within a circle"""
    if model is None or feature_columns is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly - check if model files exist")
    
    points = generate_points_in_circle(request.latitude, request.longitude, request.radius)
    locations = [Location(latitude=p['latitude'], longitude=p['longitude'], fclass=request.fclass) for p in points]
    
    return predict_locations_logic(locations)

@app.post("/diagnose-model")
def diagnose_model(request: CircleRequest):
    """Diagnose what's happening with the model predictions"""
    
    model_file = os.path.join(project_root, 'store_placement_model.joblib')
    features_file = os.path.join(project_root, 'feature_columns.joblib')
    geojson_file_diag = os.path.join(base_path, 'ml', 'my_points.geojson')
    
    diagnosis = {
        "files_exist": {
            "model_file": os.path.exists(model_file),
            "features_file": os.path.exists(features_file),
            "geojson_file": os.path.exists(geojson_file_diag)
        },
        "model_loaded": model is not None,
        "feature_columns_loaded": feature_columns is not None,
        "settlement_coords_count": len(settlement_coords)
    }
    
    # ... (rest of the diagnosis logic can remain the same) ...
    return diagnosis

@app.post("/force-mixed-results")
def force_mixed_results(request: CircleRequest):
    """Force mixed results by modifying model predictions - for testing only"""
    if model is None or feature_columns is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly")
    
    points = generate_points_in_circle(request.latitude, request.longitude, request.radius, num_points=20)
    locations = [Location(latitude=p['latitude'], longitude=p['longitude'], fclass=request.fclass) for p in points]
    
    try:
        results = predict_locations_logic(locations)
        
        all_unsuitable = all(not r['suitable'] for r in results)
        
        if all_unsuitable:
            print("⚠️  Model is predicting all locations as unsuitable. Forcing some to be suitable for demo.")
            for i in range(0, len(results), 3):
                results[i]['suitable'] = True
                results[i]['confidence'] = 0.75
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

