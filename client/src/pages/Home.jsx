import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import useTheme from "../context/useTheme";

const Home = ({ searchedLocation, user }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const primaryMarker = useRef(null);
  const predictionMarkers = useRef([]);
  const { theme } = useTheme();

  const [radiusValue, setRadiusValue] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultLocation = {
    lat: 20.2961,
    lng: 85.8245,
    name: "Bhubaneswar (Default)",
  };

  const center = searchedLocation || defaultLocation;

  const createCircleGeoJSON = (center, radiusKm) => {
    const points = 64;
    const coords = [];
    const distanceX = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
    const distanceY = radiusKm / 110.54;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center.lng + x, center.lat + y]);
    }
    coords.push(coords[0]);

    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
    };
  };

  const scrollToMap = () => {
    mapContainer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_API_KEY}`,
      center: [center.lng, center.lat],
      zoom: 13,
    });

    primaryMarker.current = new maplibregl.Marker()
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);
  }, []);

  useEffect(() => {
    if (!map.current) return;

    const { lat, lng, name } = center;

    map.current.flyTo({ center: [lng, lat], zoom: 14 });
    primaryMarker.current.setLngLat([lng, lat]);

    new maplibregl.Popup({ offset: 25 })
      .setLngLat([lng, lat])
      .setHTML(`<p style="color: #1206b1ff; font-weight: 600; font-size: 14px; margin: 0;">${name}</p>`)
      .addTo(map.current);

    if (searchedLocation) {
      setTimeout(scrollToMap, 100);
    }
  }, [center]);

  const clearPreviousAnalysis = () => {
    if (!map.current) return;
    
    predictionMarkers.current.forEach(marker => marker.remove());
    predictionMarkers.current = [];

    if (map.current.getLayer('radius-circle-border')) map.current.removeLayer('radius-circle-border');
    if (map.current.getLayer('radius-circle')) map.current.removeLayer('radius-circle');
    if (map.current.getSource('radius-circle')) map.current.removeSource('radius-circle');
  };

  const handleApplyClick = async () => {
    const radius = parseFloat(radiusValue);
    if (isNaN(radius) || radius <= 0) return;

    setIsLoading(true);
    setError(null);
    clearPreviousAnalysis();

    const circleData = createCircleGeoJSON(center, radius);
    map.current.addSource('radius-circle', { type: 'geojson', data: circleData });
    map.current.addLayer({ id: 'radius-circle', type: 'fill', source: 'radius-circle', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.2 } });
    map.current.addLayer({ id: 'radius-circle-border', type: 'line', source: 'radius-circle', paint: { 'line-color': '#3b82f6', 'line-width': 2 } });

    scrollToMap();

    try {
      const response = await fetch("https://ai-store-placement-analysis-b.onrender.com/predict-circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: center.lat,
          longitude: center.lng,
          radius: radius,
          fclass: "open_land",
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const results = await response.json();
      
      results.forEach(result => {
        const markerElement = document.createElement('div');
        markerElement.style.cssText = `width: 12px; height: 12px; border-radius: 50%; background-color: ${result.suitable ? '#22c55e' : '#ef4444'}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);`;
        
        const newMarker = new maplibregl.Marker({ element: markerElement })
          .setLngLat([result.longitude, result.latitude])
          .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<div style="font-weight: 600;">${result.suitable ? "✅ Suitable" : "❌ Not Suitable"}</div>`))
          .addTo(map.current);
        
        predictionMarkers.current.push(newMarker);
      });

      const suitableCount = results.filter(r => r.suitable).length;
      new maplibregl.Popup({ closeButton: false, offset: 25 })
        .setLngLat([center.lng, center.lat])
        .setHTML(`<div style="padding: 8px; text-align: center;"><b>Analysis Complete!</b><br>${suitableCount} / ${results.length} suitable locations.</div>`)
        .addTo(map.current);

    } catch (err) {
      console.error("Prediction error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const userEmail = typeof user === "string" ? user : user?.email || "Guest";

  return (
    <div>
      <h1 style={{ textAlign: "center", marginTop: "20px", fontSize: "1.5rem" }}>
        Welcome, {userEmail} 👋
      </h1>
      <p style={{ textAlign: "center", color: "#777", fontSize: "1.3rem", marginBottom: "10vh" }}>
        Start searching for a location in the search bar above.
      </p>

      <div style={{ width: "90%", maxWidth: "600px", margin: "0 auto 40px auto", background: theme === "dark" ? "#1f2937" : "#f8f9ff", border: theme === "dark" ? "2px solid #374151" : "2px solid #e1e8ff", borderRadius: "20px", padding: "30px", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)" }}>
        <h4 style={{ textAlign: "center", color: theme === "dark" ? "#60a5fa" : "#1e40af", fontSize: "1.4rem", fontWeight: "600" }}>
          Analysis Parameters
        </h4>
        <div style={{ textAlign: "center", marginTop: "25px" }}>
          <label htmlFor="radius-input" style={{ display: 'block', color: theme === "dark" ? "#d1d5db" : "#475569", fontSize: "1.1rem", fontWeight: "500", marginBottom: "8px" }}>
            Enter analysis radius (km):
          </label>
          <input
            id="radius-input"
            type="number"
            placeholder="e.g., 5"
            value={radiusValue}
            onChange={(e) => setRadiusValue(e.target.value)}
            style={{ width: "250px", padding: "12px 16px", borderRadius: "12px", border: `2px solid ${theme === "dark" ? "#4b5563" : "#cbd5e1"}`, fontSize: "1rem", marginBottom: "20px", backgroundColor: theme === "dark" ? "#374151" : "#ffffff", color: theme === "dark" ? "#f9fafb" : "#1f2937" }}
          />
          <br />
          <button
            onClick={handleApplyClick}
            disabled={isLoading}
            style={{ padding: "12px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", fontSize: "1rem", fontWeight: "600", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1, transition: "0.3s ease" }}
          >
            {isLoading ? 'Analyzing...' : 'Apply Analysis'}
          </button>
          {error && <p style={{ color: '#ef4444', marginTop: '15px', fontWeight: '500' }}>Error: {error}</p>}
        </div>
      </div>

      <h2 style={{ textAlign: "center", color: "#055edc", marginTop: "16vh", marginBottom: "4vh", textDecoration: "underline" }}>
        Your Map
      </h2>
      
      <div style={{ position: "relative", height: "650px", width: "90%", maxWidth: "1300px", margin: "40px auto", borderRadius: "30px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
        <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
};

export default Home;