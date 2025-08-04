import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMapMarkedAlt, FaBolt, FaSearchLocation } from "react-icons/fa";
import useTheme from "../context/useTheme";

const Landing = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: isDark
          ? "linear-gradient(135deg, #232526 0%, #414345 100%)"
          : "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)",
        color: isDark ? "#f3f4f6" : "#222",
        transition: "background 0.3s, color 0.3s"
      }}
    >
      <div style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className="text-center py-5 px-3">
          <h1 className="display-3 fw-bold mb-3" style={{ color: isDark ? "#60a5fa" : "#0a4f66" }}>
            Welcome to <span className="text-primary hover-underline">Place-it!</span>
          </h1>
          <p className="lead mb-4" style={{ color: isDark ? "#cbd5e1" : "#333" }}>
            A smart store placement tool powered by heatmap analytics and real-time location data.
          </p>
          <div className="d-flex justify-content-center flex-wrap gap-3">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate("/login")}
              aria-label="Get Started"
              style={{ marginRight: "6vw", borderRadius: "3rem" }}
            >
              Get Started
            </button>
            <button
              className={`btn btn-outline-primary btn-lg${isDark ? " border-light text-light" : ""}`}
              onClick={() => navigate("/about")}
              aria-label="Ab!"
              style={{borderRadius: "3rem"}}
            >
              About us
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="container py-5">
          <div className="row text-center g-4">
            <div className="col-md-4">
              <FaSearchLocation size={40} className="mb-3" style={{ color: isDark ? "#60a5fa" : "#0d6efd" }} />
              <h5 style={{ color: isDark ? "#93c5fd" : "#0a4f66" }}>Location Based Analysis</h5>
              <p style={{ color: isDark ? "#d1d5db" : "#333" }}>
                Analyze areas using real-time data to determine best store placement options.
              </p>
            </div>
            <div className="col-md-4">
              <FaBolt size={40} className="mb-3" style={{ color: isDark ? "#facc15" : "#ffc107" }} />
              <h5 style={{ color: isDark ? "#fde68a" : "#b45309" }}>Quick & Smart Results</h5>
              <p style={{ color: isDark ? "#d1d5db" : "#333" }}>
                Get instant heatmaps and blinking suggestions based on your input range.
              </p>
            </div>
            <div className="col-md-4">
              <FaMapMarkedAlt size={40} className="mb-3" style={{ color: isDark ? "#34d399" : "#198754" }} />
              <h5 style={{ color: isDark ? "#6ee7b7" : "#198754" }}>Interactive Map Interface</h5>
              <p style={{ color: isDark ? "#d1d5db" : "#333" }}>
                Get to know about feasibility of store placementin an intuitive and interactive interface.
              </p>
            </div>
          </div>
        </section>

        {/* How to Use */}
        <section className="container py-5">
          <div className="row align-items-center">
            <div className="col-md-6 mb-4 mb-md-0 text-center">
              <img
                src="/loc.jpg"
                alt="Place-it Illustration"
                className="img-fluid rounded-5 shadow"
                style={{ maxHeight: "300px", objectFit: "cover" }}
              />
            </div>
            <div className="col-md-6">
              <h2 className="fw-bold mb-3">Place your store in 3 easy steps:</h2>
              <ul className="list-unstyled fs-5">
                <li className="mb-1">🔍 Search for a location.</li>
                <li className="mb-1">📍 Enter the desired radius.</li>
                <li className="mb-1">⚡Click on<strong>"Analyze"</strong>, and get instant suggestions.</li>
              </ul>

              <hr />
            
            <section className="mb-2">
              <h2 className="h2 fw-bold mb-3 mt-2">Why Use Place-it?</h2>
              <ul style={{fontSize: "18px"}}>
                <li>📍 Analyze footfall and nearby facilities with real datasets</li>
                <li>🧠 Use AI to recommend ideal store zones</li>
                <li>📊 Visualize locations on an interactive map</li>
                <li>🌐 Supports <strong>PAN India</strong></li>
              </ul>
            </section>

            <button
              className="new_button btn btn-primary"
              onClick={() => navigate("/register")}
              aria-label="Get Started"
              style={{borderRadius: "3rem"}}
            >
              Let's place a new store!
            </button>

            </div>
          </div>
        </section>
      </div>


      {/* Footer */}
      <footer
        className="text-center py-4 mt-auto"
        style={{
          backgroundColor: isDark ? "#2a2b2c" : "#cbd3e1",
          color: isDark ? "#cbd5e1" : "black"
        }}
      >
        <p className="mb-0">
          &copy; {new Date().getFullYear()} <strong>Place-it!</strong> All rights reserved.
        </p>
        <p className="mb-0 mt-1" style={{ fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.7 }}>
          * Analysis is currently optimized for and limited to the South India region.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
