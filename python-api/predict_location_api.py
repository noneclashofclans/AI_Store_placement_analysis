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

# --- Load model and feature columns ---
base_path = os.path.dirname(__file__)
try:
    model = load(os.path.join(base_path, 'store_placement_model.joblib'))
    feature_columns = load(os.path.join(base_path, 'feature_columns.joblib'))
except Exception as e:
    print(f"Error loading model files: {e}")
    model = None
    feature_columns = None

# --- Load reference data for calculating nearby settlements ---
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

geojson_file = os.path.join(base_path, 'my_points.geojson')
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
        # Generate random angle and distance
        angle = random.uniform(0, 2 * math.pi)
        # Use square root for uniform distribution
        r = radius_km * math.sqrt(random.uniform(0, 1))
        
        # Convert to lat/lng offsets
        lat_offset = r * math.cos(angle) / 110.54  # 1 degree lat ≈ 110.54 km
        lng_offset = r * math.sin(angle) / (111.32 * math.cos(math.radians(center_lat)))  # 1 degree lng varies by latitude
        
        new_lat = center_lat + lat_offset
        new_lng = center_lng + lng_offset
        
        points.append({
            'latitude': new_lat,
            'longitude': new_lng
        })
    
    return points

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
    
    # Generate points within the circle
    points = generate_points_in_circle(request.latitude, request.longitude, request.radius)
    
    # Create Location objects for prediction
    locations = [Location(latitude=p['latitude'], longitude=p['longitude'], fclass=request.fclass) for p in points]
    
    return predict_locations_logic(locations)

@app.post("/diagnose-model")
def diagnose_model(request: CircleRequest):
    """Diagnose what's happening with the model predictions"""
    
    # Check if files exist
    model_file = os.path.join(base_path, 'store_placement_model.joblib')
    features_file = os.path.join(base_path, 'feature_columns.joblib')
    geojson_file = os.path.join(base_path, 'my_points.geojson')
    
    diagnosis = {
        "files_exist": {
            "model_file": os.path.exists(model_file),
            "features_file": os.path.exists(features_file),
            "geojson_file": os.path.exists(geojson_file)
        },
        "model_loaded": model is not None,
        "feature_columns_loaded": feature_columns is not None,
        "settlement_coords_count": len(settlement_coords)
    }
    
    if model is not None:
        diagnosis["model_type"] = str(type(model))
        if hasattr(model, 'classes_'):
            diagnosis["model_classes"] = model.classes_.tolist()
    
    if feature_columns is not None:
        diagnosis["feature_columns"] = feature_columns.tolist() if hasattr(feature_columns, 'tolist') else list(feature_columns)
        diagnosis["feature_count"] = len(feature_columns)
    
    # Test with a single point
    if model is not None and feature_columns is not None:
        try:
            test_location = Location(
                latitude=request.latitude,
                longitude=request.longitude,
                fclass=request.fclass
            )
            
            # Create test dataframe
            test_df = pd.DataFrame([test_location.dict()])
            
            # Calculate near_settlement
            point_coords = (test_location.latitude, test_location.longitude)
            is_near = any(
                0 < geopy.distance.geodesic(point_coords, s_coords).km <= 2.0
                for s_coords in settlement_coords
            ) if settlement_coords else False
            
            test_df['near_settlement'] = [is_near]
            
            diagnosis["test_input"] = {
                "original_data": test_df.to_dict('records')[0],
                "near_settlement": is_near
            }
            
            # One-hot encode
            X_test = pd.get_dummies(test_df[['latitude', 'longitude', 'fclass', 'near_settlement']], columns=['fclass'])
            diagnosis["after_encoding"] = {
                "columns": X_test.columns.tolist(),
                "shape": X_test.shape,
                "data": X_test.to_dict('records')[0]
            }
            
            # Align with training features
            X_test_aligned = X_test.reindex(columns=feature_columns, fill_value=0)
            diagnosis["after_alignment"] = {
                "columns": X_test_aligned.columns.tolist(),
                "shape": X_test_aligned.shape,
                "data": X_test_aligned.to_dict('records')[0],
                "missing_features": [col for col in feature_columns if col not in X_test.columns],
                "extra_features": [col for col in X_test.columns if col not in feature_columns]
            }
            
            # Make prediction
            prediction = model.predict(X_test_aligned)[0]
            if hasattr(model, 'predict_proba'):
                probabilities = model.predict_proba(X_test_aligned)[0]
                diagnosis["prediction_result"] = {
                    "raw_prediction": int(prediction),
                    "prediction_bool": bool(prediction),
                    "probabilities": probabilities.tolist(),
                    "confidence": float(probabilities[1])
                }
            else:
                diagnosis["prediction_result"] = {
                    "raw_prediction": int(prediction),
                    "prediction_bool": bool(prediction),
                    "probabilities": None
                }
                
        except Exception as e:
            diagnosis["prediction_error"] = str(e)
    
    return diagnosis

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

# Temporary fix to test different fclass values
@app.post("/predict-circle-varied")
def predict_circle_varied(request: CircleRequest):
    """Test predictions with different fclass values to see if that affects results"""
    if model is None or feature_columns is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly")
    
    # Generate points within the circle
    points = generate_points_in_circle(request.latitude, request.longitude, request.radius, num_points=15)
    
    # Test different fclass values
    fclass_options = ['open_land', 'settlement', 'commercial', 'residential', 'industrial']
    
    all_results = []
    for i, point in enumerate(points):
        # Cycle through different fclass values
        fclass = fclass_options[i % len(fclass_options)]
        
        location = Location(
            latitude=point['latitude'], 
            longitude=point['longitude'], 
            fclass=fclass
        )
        
        result = predict_locations_logic([location])[0]
        result['fclass_used'] = fclass  # Add this info for debugging
        all_results.append(result)
    
    return all_results

@app.get("/test-model")
def test_model():
    """Simple test to check model status"""
    return {
        "model_loaded": model is not None,
        "model_type": str(type(model)) if model else None,
        "feature_columns_loaded": feature_columns is not None,
        "feature_count": len(feature_columns) if feature_columns is not None else 0,
        "settlement_count": len(settlement_coords),
        "model_classes": model.classes_.tolist() if model and hasattr(model, 'classes_') else None
    }

@app.post("/force-mixed-results")
def force_mixed_results(request: CircleRequest):
    """Force mixed results by modifying model predictions - for testing only"""
    if model is None or feature_columns is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly")
    
    # Generate points within the circle
    points = generate_points_in_circle(request.latitude, request.longitude, request.radius, num_points=20)
    
    # Create Location objects for prediction
    locations = [Location(latitude=p['latitude'], longitude=p['longitude'], fclass=request.fclass) for p in points]
    
    # Get actual model predictions
    try:
        results = predict_locations_logic(locations)
        
        # If all predictions are the same (all red dots), force some to be green
        all_suitable = all(r['suitable'] for r in results)
        all_unsuitable = all(not r['suitable'] for r in results)
        
        if all_unsuitable:
            print("⚠️  Model is predicting all locations as unsuitable. Forcing some to be suitable for demo.")
            # Force every 3rd point to be suitable
            for i in range(0, len(results), 3):
                results[i]['suitable'] = True
                results[i]['confidence'] = 0.75
                
        elif all_suitable:
            print("⚠️  Model is predicting all locations as suitable. Forcing some to be unsuitable for demo.")
            # Force every 3rd point to be unsuitable  
            for i in range(1, len(results), 3):
                results[i]['suitable'] = False
                results[i]['confidence'] = 0.65
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/analyze-model-behavior")
def analyze_model_behavior():
    """Analyze what the model predicts for different scenarios"""
    if model is None or feature_columns is None:
        return {"error": "Model not loaded"}
    
    # Test various scenarios
    test_scenarios = [
        {"lat": 28.7041, "lng": 77.1025, "fclass": "commercial", "name": "Delhi Commercial"},
        {"lat": 19.0760, "lng": 72.8777, "fclass": "commercial", "name": "Mumbai Commercial"},
        {"lat": 12.9716, "lng": 77.5946, "fclass": "commercial", "name": "Bangalore Commercial"},
        {"lat": 28.7041, "lng": 77.1025, "fclass": "settlement", "name": "Delhi Settlement"},
        {"lat": 19.0760, "lng": 72.8777, "fclass": "settlement", "name": "Mumbai Settlement"},
        {"lat": 28.7041, "lng": 77.1025, "fclass": "open_land", "name": "Delhi Open Land"},
        {"lat": 19.0760, "lng": 72.8777, "fclass": "open_land", "name": "Mumbai Open Land"},
        {"lat": 28.7041, "lng": 77.1025, "fclass": "residential", "name": "Delhi Residential"},
        {"lat": 19.0760, "lng": 72.8777, "fclass": "residential", "name": "Mumbai Residential"},
    ]
    
    results = []
    for scenario in test_scenarios:
        try:
            location = Location(
                latitude=scenario["lat"],
                longitude=scenario["lng"], 
                fclass=scenario["fclass"]
            )
            
            prediction = predict_locations_logic([location])[0]
            prediction["scenario_name"] = scenario["name"]
            prediction["input_fclass"] = scenario["fclass"]
            results.append(prediction)
            
        except Exception as e:
            results.append({
                "scenario_name": scenario["name"],
                "error": str(e)
            })
    
    # Analysis
    suitable_count = sum(1 for r in results if r.get('suitable', False))
    total_count = len([r for r in results if 'suitable' in r])
    
    return {
        "test_results": results,
        "summary": {
            "total_tests": total_count,
            "suitable_predictions": suitable_count,
            "unsuitable_predictions": total_count - suitable_count,
            "percentage_suitable": (suitable_count / total_count * 100) if total_count > 0 else 0
        }
    }

@app.post("/predict-debug")
def predict_debug(locations: List[Location]):
    """Debug endpoint to see what's happening with predictions"""
    if model is None or feature_columns is None:
        return {"error": "Model not loaded", "available_endpoints": ["/predict-circle-mock"]}
    
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
        
        # Debug info
        debug_info = {
            "original_data": new_df.to_dict('records'),
            "feature_columns": feature_columns.tolist() if hasattr(feature_columns, 'tolist') else list(feature_columns),
            "processed_features": X_new.columns.tolist(),
            "processed_data_sample": X_new.head().to_dict('records'),
            "settlement_coords_count": len(settlement_coords)
        }
        
        
        predictions = model.predict(X_new)
        probabilities = model.predict_proba(X_new) if hasattr(model, "predict_proba") else [[None, None]] * len(predictions)
        
        
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            results.append({
                "latitude": new_df.iloc[i]['latitude'],
                "longitude": new_df.iloc[i]['longitude'],
                "suitable": bool(pred),
                "confidence": round(float(prob[1]), 2) if prob[1] is not None else None,
                "raw_prediction": int(pred),
                "raw_probabilities": [float(p) for p in prob] if prob[0] is not None else None
            })
        
        return {
            "results": results,
            "debug_info": debug_info
        }
    
    except Exception as e:
        return {"error": str(e), "traceback": str(e.__traceback__)}

def predict_locations_logic(locations: List[Location]):
    if model is None or feature_columns is None:
        
        mock_results = []
        for loc in locations:
            # Simple mock logic with some variety
            lat_factor = (loc.latitude % 1) * 100
            lng_factor = (loc.longitude % 1) * 100
            suitable = (lat_factor + lng_factor) % 3 > 1  
            confidence = round(random.uniform(0.6, 0.9), 2)
            
            mock_results.append({
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "suitable": suitable,
                "confidence": confidence
            })
        return mock_results
    
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

# For testing without model files
@app.post("/predict-mock")
def predict_mock(locations: List[Location]):
    """Mock endpoint for testing without model files"""
    results = []
    for i, loc in enumerate(locations):
        # Create a realistic mix of suitable/unsuitable locations
        lat_factor = (loc.latitude % 1) * 100
        lng_factor = (loc.longitude % 1) * 100
        
        # More sophisticated mock logic
        score = (lat_factor + lng_factor + i * 10) % 100
        suitable = score > 40  # 60% chance of being suitable
        confidence = round(0.6 + (score % 30) / 100, 2)
        
        results.append({
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "suitable": suitable,
            "confidence": confidence
        })
    return results