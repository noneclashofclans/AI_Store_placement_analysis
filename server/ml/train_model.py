import json
import os
import pandas as pd
import numpy as np
import geopy.distance
from joblib import dump
from shapely.geometry import Point
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# --- Step 1: Merge and Process Multiple GeoJSON Files ---
def merge_geojson_files(paths):
    all_features = []
    for path in paths:
        with open(path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
            all_features.extend(geojson_data['features'])

    merged = {
        "type": "FeatureCollection",
        "features": all_features
    }

    return merged

def process_geojson_data(geojson_data):
    data = []
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
    return pd.DataFrame(data)

# --- Step 2: Find Nearby Settlements ---
def calculate_near_settlement(df):
    settlements = df[df['fclass'] == 'settlement']
    if settlements.empty:
        df['near_settlement'] = False
        return df
    settlement_coords = list(zip(settlements['latitude'], settlements['longitude']))
    near_settlement_list = []
    for _, row in df.iterrows():
        point_coords = (row['latitude'], row['longitude'])
        is_near = any(
            0 < geopy.distance.geodesic(point_coords, s_coords).km <= 2.0
            for s_coords in settlement_coords
        )
        near_settlement_list.append(is_near)
    df['near_settlement'] = near_settlement_list
    return df

# --- Step 3: Create Training Labels ---
def create_training_data(df):
    training_df = df[df['fclass'].isin(['supermarket', 'shop', 'open_land'])].copy()

    training_df.loc[training_df['name'] == 'Big Bazaar', 'suitable'] = True
    training_df.loc[training_df['name'] == 'Reliance Trends', 'suitable'] = True
    training_df.loc[training_df['name'] == 'City Centre 1', 'suitable'] = True
    training_df.loc[training_df['name'] == 'Spencer\'s', 'suitable'] = True

    training_df.loc[training_df['fclass'] == 'open_land', 'suitable'] = False
    training_df['suitable'] = training_df['suitable'].fillna(False)

    return training_df

# --- Main ---
if __name__ == "__main__":
    # Paths to geojson files
    base_path = os.path.dirname(__file__)
    geojson_paths = [
        os.path.join(base_path, 'my_points.geojson'),
        os.path.join(base_path, 'central_points.geojson'),
        os.path.join(base_path, 'west_points.geojson')
    ]

    print("🛠 Merging and processing GeoJSON files...")
    combined_geojson = merge_geojson_files(geojson_paths)
    df = process_geojson_data(combined_geojson)

    print("📍 Calculating 'near_settlement'...")
    df = calculate_near_settlement(df)

    print("🏷 Creating training data...")
    training_data = create_training_data(df)
    training_data = training_data[training_data['suitable'].notna()]

    if training_data.empty:
        print("❌ No training labels found. Please label your data.")
        exit()

    print(f"✅ Found {len(training_data)} labeled rows.")

    # Features & Labels
    features = ['latitude', 'longitude', 'fclass', 'near_settlement']
    X = pd.get_dummies(training_data[features], columns=['fclass'], drop_first=True)
    y = training_data['suitable']

    # Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42
    )

    print("🧠 Training model...")
    model = RandomForestClassifier(
        n_estimators=100, random_state=42, class_weight='balanced'
    )
    model.fit(X_train, y_train)

    acc = accuracy_score(y_test, model.predict(X_test))
    print(f"✅ Model Accuracy: {acc:.2f}")

    # Save model and columns
    model_path = os.path.join(base_path, 'store_placement_model.joblib')
    columns_path = os.path.join(base_path, 'feature_columns.joblib')
    dump(model, model_path)
    dump(X.columns.tolist(), columns_path)

    print("💾 Model saved as store_placement_model.joblib")
    print("💾 Feature columns saved as feature_columns.joblib")
