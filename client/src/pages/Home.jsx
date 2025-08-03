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
      geometry: {
        type: "Polygon",
        coordinates: [coords]
      }
    };
  };

  const addRadiusCircle = (radiusKm) => {
    if (!map.current) return;

    const circleData = createCircleGeoJSON(center, radiusKm);

    if (map.current.getLayer('radius-circle')) {
      map.current.removeLayer('radius-circle');
    }
    if (map.current.getSource('radius-circle')) {
      map.current.removeSource('radius-circle');
    }

    map.current.addSource('radius-circle', {
      type: 'geojson',
      data: circleData
    });

    map.current.addLayer({
      id: 'radius-circle',
      type: 'fill',
      source: 'radius-circle',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.2
      }
    });

    map.current.addLayer({
      id: 'radius-circle-border',
      type: 'line',
      source: 'radius-circle',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-opacity': 0.8
      }
    });
  };

  const scrollToMap = () => {
    if (mapContainer.current) {
      mapContainer.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_API_KEY}`,
      center: [center.lng, center.lat],
      zoom: 13,
    });

    marker.current = new maplibregl.Marker()
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);
  }, [center.lng, center.lat]);

  useEffect(() => {
    if (!map.current) return;

    const { lat, lng, name } = center;

    map.current.flyTo({
      center: [lng, lat],
      zoom: 14,
    });

    marker.current.setLngLat([lng, lat]);

    new maplibregl.Popup({ offset: 25 })
      .setLngLat([lng, lat])
      .setHTML(
        `<p style="color: #1206b1ff; font-weight: 600; font-size: 14px; margin: 0;">
          ${name}
        </p>`
      )
      .addTo(map.current);

    if (searchedLocation) {
      setTimeout(() => {
        scrollToMap();
      }, 100);
    }

  }, [center, theme, searchedLocation]);

  const handleApplyClick = async () => {
    const radius = parseFloat(radiusValue);
    if (isNaN(radius) || radius <= 0 || !map.current) return;

    addRadiusCircle(radius);
    scrollToMap();

    // Clear existing prediction markers
    const existingMarkers = document.querySelectorAll('.prediction-marker');
    existingMarkers.forEach(marker => marker.remove());

    try {
      console.log('Sending request to backend...');
      
      // First test what the model is doing
      const testResponse = await fetch("http://localhost:8000/analyze-model-behavior", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (testResponse.ok) {
        const testResult = await testResponse.json();
        console.log('🧪 Model Behavior Analysis:', testResult);
        
        if (testResult.summary && testResult.summary.percentage_suitable < 10) {
          console.log('⚠️ WARNING: Model predicts less than 10% suitable locations across all test scenarios');
          console.log('This suggests the model has a strong bias toward "not suitable" predictions');
        }
      }

      
      let response = await fetch("http://localhost:8000/force-mixed-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      
      // Add markers for each prediction result
      results.forEach((result, index) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'prediction-marker';
        markerElement.style.width = '12px';
        markerElement.style.height = '12px';
        markerElement.style.borderRadius = '50%';
        markerElement.style.backgroundColor = result.suitable ? '#22c55e' : '#ef4444';
        markerElement.style.border = '2px solid white';
        markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

        const marker = new maplibregl.Marker({ element: markerElement })
          .setLngLat([result.longitude, result.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 15 }).setHTML(
              `<div style="text-align: center; font-size: 14px; font-weight: 600; color: #000000ff;">
                <strong>${result.suitable ? "✅ Suitable" : "❌ Not Suitable"}</strong>
                ${result.confidence ? `<br>Confidence: ${(result.confidence * 100).toFixed(0)}%` : ''}
              </div>`
            )
          )
          .addTo(map.current);
      });

      // Show summary
      const suitableCount = results.filter(r => r.suitable).length;
      const totalCount = results.length;
      
      new maplibregl.Popup({ offset: 25 })
        .setLngLat([center.lng, center.lat])
        .setHTML(
          `<div style="text-align: center; font-size: 16px; font-weight: 600; color: #87ceeb; padding: 8px;">
            <strong>Analysis Complete!</strong><br>
            ${suitableCount} suitable locations found<br>
            out of ${totalCount} analyzed points
          </div>`
        )
        .addTo(map.current);

    } catch (error) {
      console.error("Prediction error:", error);
      
      // Fallback to single point prediction
      try {
        console.log('Trying fallback single point prediction...');
        const fallbackResponse = await fetch("http://localhost:8000/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            {
              latitude: center.lat,
              longitude: center.lng,
              fclass: "open_land"
            }
          ])
        });

        if (fallbackResponse.ok) {
          const result = await fallbackResponse.json();
          const isSuitable = result[0]?.suitable;

          new maplibregl.Marker({
            color: isSuitable ? "green" : "red",
          })
            .setLngLat([center.lng, center.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(
                `<p style="color: #87ceeb; font-weight: 600; font-size: 14px;">${isSuitable ? "Suitable" : "Not Suitable"}</p>`
              )
            )
            .addTo(map.current);
        } else {
          throw new Error(`Fallback also failed: ${fallbackResponse.status}`);
        }
      } catch (fallbackError) {
        console.error("Fallback prediction error:", fallbackError);
        alert(`Error: ${error.message}\nFallback: ${fallbackError.message}\n\nPlease check if the FastAPI server is running on http://localhost:8000`);
      }
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

      <div style={{
        width: "90%",
        maxWidth: "600px",
        margin: "0 auto 40px auto",
        background: theme === "dark" 
          ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)" 
          : "linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%)",
        border: theme === "dark" 
          ? "2px solid #374151" 
          : "2px solid #e1e8ff",
        borderRadius: "20px",
        padding: "30px",
        boxShadow: theme === "dark" 
          ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)" 
          : "0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(59, 130, 246, 0.08)",
        position: "relative"
      }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h4 style={{
            color: theme === "dark" ? "#60a5fa" : "#1e40af",
            fontSize: "1.4rem",
            fontWeight: "600",
            textDecoration: "underline",
            textDecorationColor: theme === "dark" ? "#60a5fa" : "#3b82f6",
          }}>
            Enter the following details:
          </h4>
        </div>

        <div style={{ textAlign: "center" }}>
          <h5 style={{ 
            color: theme === "dark" ? "#d1d5db" : "#475569", 
            fontSize: "1.1rem", 
            fontWeight: "500" 
          }}>
            Enter radius:
          </h5>
          <input
            type="number"
            placeholder="Enter radius in km"
            value={radiusValue}
            onChange={(e) => setRadiusValue(e.target.value)}
            style={{
              width: "250px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: theme === "dark" ? "2px solid #4b5563" : "2px solid #cbd5e1",
              fontSize: "1rem",
              marginBottom: "10px",
              backgroundColor: theme === "dark" ? "#374151" : "#ffffff",
              color: theme === "dark" ? "#f9fafb" : "#1f2937"
            }}
          />
          <br />
          <button
            onClick={handleApplyClick}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "white",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "0.3s ease"
            }}
          >
            Apply
          </button>
        </div>
      </div>

      <h2 style={{ textAlign: "center", color: "#055edc", marginTop: "16vh", marginBottom: "4vh", textDecoration: "underline" }}>
        Your Map
      </h2>

      <div style={{
        position: "relative",
        height: "650px",
        width: "90%",
        maxWidth: "1300px",
        margin: "40px auto",
        borderRadius: "30px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}>
        <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />

        <div style={{
          position: "absolute",
          top: 10,
          right: 10,
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
              background: "#535a63ff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            ＋
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            style={{
              padding: "8px 12px",
              fontSize: "18px",
              background: "#535a63ff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
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