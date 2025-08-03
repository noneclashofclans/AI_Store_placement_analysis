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
    // Clean up function to remove the map when the component unmounts or re-renders
    if (map.current) {
        map.current.remove();
        map.current = null;
    }

    const mapStyleUrl = theme === "dark"
      ? "https://api.maptiler.com/maps/basic-v2/style.json?key=0OYIZWdDoSrlOX2uXSzh"
      : "https://api.maptiler.com/maps/streets/style.json?key=0OYIZWdDoSrlOX2uXSzh";

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: [center.lng, center.lat],
      zoom: 13,
    });

    marker.current = new maplibregl.Marker()
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);

    // This is the cleanup function that runs before the next render.
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [center.lng, center.lat, theme]);

  // This hook handles flyTo and popup logic
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
        `<p style="color: ${theme === "dark" ? "#ffffff" : "#000000"}; margin: 0; background: ${theme === "dark" ? "#333333" : "#ffffff"}; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
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
    setPredictionResults(null);

    const existingMarkers = document.querySelectorAll('.prediction-marker');
    existingMarkers.forEach(marker => marker.remove());

    try {
      console.log('Sending request to backend...');
      
      let response = await fetch("https://ai-store-placement-analysis.onrender.com/force-mixed-results", {
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
      setPredictionResults(results);

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
              `<div style="text-align: center; font-size: 12px; padding: 5px; color: ${theme === "dark" ? "#ffffff" : "#000000"}; background: ${theme === "dark" ? "#333333" : "#ffffff"}; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                <strong>${result.suitable ? "✅ Suitable" : "❌ Not Suitable"}</strong>
                ${result.confidence ? `<br>Confidence: ${(result.confidence * 100).toFixed(0)}%` : ''}
              </div>`
            )
          )
          .addTo(map.current);
      });

      const suitableCount = results.filter(r => r.suitable).length;
      const totalCount = results.length;
      
      new maplibregl.Popup({ offset: 25 })
        .setLngLat([center.lng, center.lat])
        .setHTML(
          `<div style="text-align: center; font-size: 14px; padding: 8px; color: ${theme === "dark" ? "#ffffff" : "#000000"}; background: ${theme === "dark" ? "#333333" : "#ffffff"}; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            <strong>Analysis Complete!</strong><br>
            ${suitableCount} suitable locations found<br>
            out of ${totalCount} analyzed points
          </div>`
        )
        .addTo(map.current);

    } catch (error) {
      console.error("Prediction error:", error);
      
      try {
        console.log('Trying fallback single point prediction...');
        const fallbackResponse = await fetch("https://ai-store-placement-analysis.onrender.com/predict", {
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
                `<div style="color: ${theme === "dark" ? "#ffffff" : "#000000"}; background: ${theme === "dark" ? "#333333" : "#ffffff"}; padding: 5px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                  <p>${isSuitable ? "Suitable" : "Not Suitable"}</p>
                </div>`
              )
            )
            .addTo(map.current);
        } else {
          throw new Error(`Fallback also failed: ${fallbackResponse.status}`);
        }
      } catch (fallbackError) {
        console.error("Fallback prediction error:", fallbackError);
        alert(`Error: ${error.message}\nFallback: ${fallbackError.message}\n\nPlease check if the FastAPI server is running on https://ai-store-placement-analysis.onrender.com/`);
      }
    }
  };

  const userEmail = typeof user === "string" ? user : user?.email || "Guest";

  return (
    <div style={{
      backgroundColor: theme === "dark" ? "#1a202c" : "#f7fafc",
      color: theme === "dark" ? "#e2e8f0" : "#1a202c",
      minHeight: "100vh",
      padding: "2rem 0",
      transition: "background-color 0.3s ease",
      fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    }}>
      <h1 style={{
        textAlign: "center",
        fontSize: "2.25rem",
        fontWeight: "bold",
        marginBottom: "1rem",
        color: theme === "dark" ? "#90cdf4" : "#2a4365",
      }}>
        Welcome, {userEmail} 👋
      </h1>
      <p style={{
        textAlign: "center",
        fontSize: "1.125rem",
        color: theme === "dark" ? "#a0aec0" : "#4a5568",
        marginBottom: "2rem",
      }}>
        Start searching for a location in the search bar above.
      </p>

      <div style={{
        width: "90%",
        maxWidth: "600px",
        margin: "0 auto 40px auto",
        backgroundColor: theme === "dark" ? "#2d3748" : "#ffffff",
        border: `2px solid ${theme === "dark" ? "#4a5568" : "#e2e8f0"}`,
        borderRadius: "20px",
        padding: "30px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        position: "relative",
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h4 style={{
            color: theme === "dark" ? "#90cdf4" : "#1e40af",
            fontSize: "1.4rem",
            fontWeight: "600",
            textDecoration: "underline",
            textDecorationColor: theme === "dark" ? "#63b3ed" : "#3b82f6",
          }}>
            Enter the following details:
          </h4>
        </div>

        <div style={{ textAlign: "center" }}>
          <h5 style={{
            color: theme === "dark" ? "#cbd5e0" : "#475569",
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
              border: `2px solid ${theme === "dark" ? "#4a5568" : "#cbd5e1"}`,
              backgroundColor: theme === "dark" ? "#2d3748" : "#ffffff",
              color: theme === "dark" ? "#e2e8f0" : "#1a202c",
              fontSize: "1rem",
              marginBottom: "10px",
              transition: "all 0.3s ease",
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
              transition: "0.3s ease",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      <h2 style={{
        textAlign: "center",
        color: theme === "dark" ? "#63b3ed" : "#055edc",
        marginTop: "16vh",
        marginBottom: "4vh",
        fontSize: "2rem",
        fontWeight: "bold",
        textDecoration: "underline",
      }}>
        Your Map
      </h2>
      
      {predictionResults && (
        <div style={{
          textAlign: "center",
          marginBottom: "2rem",
          fontSize: "1rem",
          padding: "1rem",
          backgroundColor: theme === "dark" ? "#2d3748" : "#e2e8f0",
          color: theme === "dark" ? "#e2e8f0" : "#1a202c",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "600px",
          margin: "0 auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          transition: "background-color 0.3s ease",
        }}>
          <strong>Analysis Summary:</strong><br/>
          {predictionResults.filter(r => r.suitable).length} suitable locations found out of {predictionResults.length} analyzed points.
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
              background: theme === "dark" ? "#4a5568" : "#535a63",
              color: "#fff",
              border: "none",
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
              background: theme === "dark" ? "#4a5568" : "#535a63",
              color: "#fff",
              border: "none",
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