import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import useTheme from "../context/useTheme";

const Home = ({ searchedLocation, user }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const { theme } = useTheme();
  const [radiusValue, setRadiusValue] = useState('');
  const [predictionResults, setPredictionResults] = useState(null);

  const defaultLocation = {
    lat: 20.2961,
    lng: 85.8245,
    name: "Bhubaneswar (Default)",
  };

  const center = searchedLocation || defaultLocation;

  const createCircleGeoJSON = (center, radiusKm) => {
    const points = 64;
    const coords = [];
    const distanceX = radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180));
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
      geometry: { type: "Polygon", coordinates: [coords] }
    };
  };

  // This function adds the circle to the map
  const addRadiusCircle = (radiusKm) => {
    if (!map.current) return;
    const circleData = createCircleGeoJSON(center, radiusKm);
    
    const circlePaint = {
        'fill-color': theme === 'dark' ? '#14b8a6' : '#0d9488', // Teal color
        'fill-opacity': 0.2
    };
    const borderPaint = {
        'line-color': theme === 'dark' ? '#14b8a6' : '#0d9488', // Teal color
        'line-width': 2,
        'line-opacity': 0.8
    };

    if (map.current.getSource('radius-circle')) {
        map.current.getSource('radius-circle').setData(circleData);
        map.current.setPaintProperty('radius-circle', 'fill-color', circlePaint['fill-color']);
        map.current.setPaintProperty('radius-circle-border', 'line-color', borderPaint['line-color']);
    } else {
      map.current.addSource('radius-circle', { type: 'geojson', data: circleData });
      map.current.addLayer({
        id: 'radius-circle',
        type: 'fill',
        source: 'radius-circle',
        paint: circlePaint
      });
      map.current.addLayer({
        id: 'radius-circle-border',
        type: 'line',
        source: 'radius-circle',
        paint: borderPaint
      });
    }
  };
  
  const scrollToMap = () => {
    mapContainer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (map.current) {
        map.current.remove();
        map.current = null;
    };

    const mapStyleUrl = theme === "dark"
      ? "https://api.maptiler.com/maps/dataviz-dark/style.json?key=0OYIZWdDoSrlOX2uXSzh" 
      : "https://api.maptiler.com/maps/dataviz-light/style.json?key=0OYIZWdDoSrlOX2uXSzh"; 

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: [center.lng, center.lat],
      zoom: 13,
    });

    marker.current = new maplibregl.Marker({color: '#14b8a6'}).setLngLat([center.lng, center.lat]).addTo(map.current);
    
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [theme]);

  // useEffect to handle location changes
  useEffect(() => {
    if (!map.current) return;
    const { lat, lng, name } = center;
    map.current.flyTo({ center: [lng, lat], zoom: 14 });
    marker.current.setLngLat([lng, lat]);
    new maplibregl.Popup({ offset: 25 })
      .setLngLat([lng, lat])
      .setHTML(`<div style="padding: 4px 8px; color: ${theme === "dark" ? "#fff" : "#000"}; background: ${theme === 'dark' ? '#1e293b' : '#fff'}; border-radius: 4px;">${name}</div>`)
      .addTo(map.current);
    if (searchedLocation) setTimeout(() => scrollToMap(), 1000);
  }, [center, searchedLocation, theme]);

  const handleApplyClick = async () => {
    const radius = parseFloat(radiusValue);
    if (isNaN(radius) || radius <= 0 || !map.current) return;

    addRadiusCircle(radius);
    scrollToMap();
    setPredictionResults(null);

    const existingMarkers = document.querySelectorAll('.prediction-marker');
    existingMarkers.forEach(marker => marker.remove());

    try {
      console.log('Sending request to backend...');
      const apiUrl = "https://store-api-backend-new.onrender.com/";
      
      let response = await fetch(`${apiUrl}/predict-circle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: center.lat,
          longitude: center.lng,
          radius: radius,
          fclass: "open_land"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const results = await response.json();
      console.log('Response from backend:', results);
      setPredictionResults(results);

      results.forEach((result) => {
        const placeName = result.place_name && result.place_name.trim() !== '' ? result.place_name : 'Analyzed Point';

        new maplibregl.Marker({
          color: result.suitable ? '#22c55e' : '#ef4444',
          className: 'prediction-marker'
        })
          .setLngLat([result.longitude, result.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<div style="font-size: 13px; padding: 8px; color: ${theme === "dark" ? "#fff" : "#0f172a"}; background: ${theme === "dark" ? "#1e293b" : "#fff"}; border-radius: 5px; border: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'};">
                <strong style="font-size: 14px; color: ${result.suitable ? '#22c55e' : '#ef4444'};">
                  ${result.suitable ? "✅ Suitable" : "❌ Not Suitable"}
                </strong>
                <hr style="margin: 6px 0; border: none; border-top: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'};" />
                <div style="font-weight: 500;">${placeName}</div>
                ${result.confidence ? `<div style="font-size: 12px; color: #64748b;">Confidence: ${(result.confidence * 100).toFixed(0)}%</div>` : ''}
              </div>`
            )
          )
          .addTo(map.current);
      });

      const suitableCount = results.filter(r => r.suitable).length;
      const totalCount = results.length;
      
      new maplibregl.Popup({ offset: 25, closeButton: false, closeOnClick: true })
        .setLngLat([center.lng, center.lat])
        .setHTML(
          `<div style="text-align: center; font-size: 14px; padding: 8px; color: ${theme === "dark" ? "#fff" : "#0f172a"}; background: ${theme === "dark" ? "#1e293b" : "#fff"}; border-radius: 5px; border: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'};">
            <strong>Analysis Complete!</strong><br>
            <span style="color: #22c55e; font-weight: bold;">${suitableCount} suitable</span> found<br>
            out of ${totalCount} points.
          </div>`
        )
        .addTo(map.current);

    } catch (error) {
      console.error("Prediction error:", error);
      alert(`An error occurred during prediction. Please ensure the backend server is running and check the console for details.`);
    }
  };

  const userEmail = typeof user === "string" ? user : user?.email || "Guest";

  return (
    <div style={{
      backgroundColor: theme === "dark" ? "#0f172a" : "#f1f5f9", // slate-900 | slate-100
      color: theme === "dark" ? "#e2e8f0" : "#1e293b", // slate-200 | slate-800
      minHeight: "100vh",
      padding: "2rem 0",
      transition: "background-color 0.3s ease",
      fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    }}>
      <h3 style={{
        textAlign: "center",
        fontSize: "1.25rem",
        fontWeight: "500",
        marginBottom: "1rem",
        color: theme === "dark" ? "#94a3b8" : "#475569", // slate-400 | slate-600
      }}>
        Welcome, {userEmail} 👋
      </h3>
      <p style={{
        textAlign: "center",
        fontSize: "1.125rem",
        color: theme === "dark" ? "#94a3b8" : "#64748b", // slate-400 | slate-500
        marginBottom: "2rem",
      }}>
        Start searching for a location or use the map below to analyze an area.
      </p>

      <div style={{
        width: "90%",
        maxWidth: "600px",
        margin: "0 auto 40px auto",
        backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff", // slate-800 | white
        border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`, // slate-700 | slate-200
        borderRadius: "20px",
        padding: "30px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h4 style={{
            color: theme === "dark" ? "#5eead4" : "#0d9488", // teal-300 | teal-700
            fontSize: "1.4rem",
            fontWeight: "600",
          }}>
            Analyze an Area
          </h4>
        </div>

        <div style={{ textAlign: "center" }}>
          <h5 style={{
            color: theme === "dark" ? "#94a3b8" : "#64748b", // slate-400 | slate-500
            fontSize: "1.1rem",
            fontWeight: "500"
          }}>
            Enter analysis radius (km):
          </h5>
          <input
            type="number"
            placeholder="e.g., 2.5"
            value={radiusValue}
            onChange={(e) => setRadiusValue(e.target.value)}
            style={{
              width: "250px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: `2px solid ${theme === "dark" ? "#475569" : "#cbd5e1"}`, // slate-600 | slate-300
              backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff", // slate-800 | white
              color: theme === "dark" ? "#e2e8f0" : "#1a202c", // slate-200 | slate-800
              fontSize: "1rem",
              marginBottom: "20px",
              transition: "all 0.3s ease",
            }}
          />
          <br />
          <button
            onClick={handleApplyClick}
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #2dd4bf, #14b8a6)", // teal-400 to teal-500
              color: "white",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "transform 0.2s ease",
              boxShadow: "0 4px 12px rgba(20, 184, 166, 0.3)",
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Analyze
          </button>
        </div>
      </div>

      <h2 style={{
        textAlign: "center",
        color: theme === "dark" ? "#5eead4" : "#0f766e", // teal-300 | teal-600
        marginTop: "16vh",
        marginBottom: "4vh",
        fontSize: "2rem",
        fontWeight: "bold",
      }}>
        Your Map
      </h2>
      
      {predictionResults && (
        <div style={{
          textAlign: "center",
          marginBottom: "2rem",
          fontSize: "1rem",
          padding: "1rem",
          backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff", // slate-800 | white
          color: theme === "dark" ? "#e2e8f0" : "#1e293b", // slate-200 | slate-800
          borderRadius: "12px",
          width: "90%",
          maxWidth: "600px",
          margin: "2rem auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`
        }}>
          <strong>Analysis Summary:</strong><br/>
          <span style={{ color: '#22c55e', fontWeight: 'bold' }}>
            {predictionResults.filter(r => r.suitable).length} suitable
          </span> locations found out of {predictionResults.length} analyzed points.
        </div>
      )}

      <div style={{
        position: "relative",
        height: "650px",
        width: "90%",
        maxWidth: "1300px",
        margin: "40px auto",
        borderRadius: "30px",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        border: `2px solid ${theme === 'dark' ? '#334155' : 'transparent'}` // slate-700
      }}>
        <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />

        <div style={{
          position: "absolute",
          top: 15,
          right: 15,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 10,
        }}>
          <button
            onClick={() => map.current?.zoomIn()}
            style={{
              padding: "8px 12px",
              fontSize: "18px",
              background: theme === "dark" ? "rgba(45, 55, 72, 0.8)" : "rgba(255, 255, 255, 0.8)",
              color: theme === 'dark' ? '#fff' : '#000',
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            ＋
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            style={{
              padding: "8px 12px",
              fontSize: "18px",
              background: theme === "dark" ? "rgba(45, 55, 72, 0.8)" : "rgba(255, 255, 255, 0.8)",
              color: theme === 'dark' ? '#fff' : '#000',
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            －
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
