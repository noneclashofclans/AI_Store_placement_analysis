import React, { useState } from "react";
import { useLocation, useNavigate, NavLink } from "react-router-dom";
import useTheme from "../context/useTheme";
import { Sun, Moon } from "lucide-react";

const Navbar = ({ onLogout, user, setSearchedLocation}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleNavigate = (path) => { 
    navigate(path);
    setIsOpen(false);
  };

  const getActiveClassName = ({ isActive }) =>
    isActive ? "nav-link active text-primary fw-semibold" : "nav-link";

  const isAuthPage = ["/", "/login", "/register"].includes(location.pathname);

  // search bar functionality
  const handleSearch = async (e) => {
  e.preventDefault();
  if (searchQuery.trim()) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const location = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: data[0].display_name,
        };
        setSearchedLocation(location);
        navigate("/home"); 
      } else {
        alert("The following location doesn't exist. Kindly check the location you have entered.");
      }
    } catch (error) {
      console.error("Error fetching location:", error);
      alert("Failed to fetch location.");
    }
    setIsOpen(false);
  }
};


  return (
    <nav
      className={`navbar navbar-expand-lg px-3 py-2 border-bottom shadow-sm ${
        theme === "dark" ? "navbar-dark bg-dark" : "navbar-light bg-white"
      }`}
      style={{ position: "sticky", top: 0, zIndex: 1000 }}
    >
      <div className="container-fluid">
        {/* Brand */}
        <span
          className="navbar-brand fs-4 fw-bold"
          onClick={() => handleNavigate(user && location.pathname === "/home" ? "/" : user ? "/home" : "/")}
          style={{ cursor: "pointer", letterSpacing: "1px" }}
        >
          Place-it<span className="text-primary">!</span>
        </span>

        {/* Toggler */}
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-controls="navbarNav"
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapse content */}
        <div
          className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
          id="navbarNav"
        >
          {/* Nav Links */}
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-lg-3">
            {user && (
              <>
                <li className="nav-item" key="home">
                  <NavLink
                    to="/home"
                    className={getActiveClassName}
                    onClick={() => setIsOpen(false)}
                  >
                    Home
                  </NavLink>
                </li>
                <li className="nav-item" key="about">
                  <NavLink
                    to="/about"
                    className={getActiveClassName}
                    onClick={() => setIsOpen(false)}
                  >
                    About
                  </NavLink>
                </li>
              </>
            )}

            {isAuthPage && (
              <>
                <li className="nav-item" key="login">
                  <NavLink
                    to="/login"
                    className={getActiveClassName}
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </NavLink>
                </li>
                <li className="nav-item" key="register">
                  <NavLink
                    to="/register"
                    className={getActiveClassName}
                    onClick={() => setIsOpen(false)}
                  >
                    Register
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          {/* Right Side: Search, User Info, Actions */}
          <div
            className="d-flex align-items-center flex-wrap mt-3 mt-lg-0"
            style={{ gap: "1.5rem" }}
          >
            {/* Search Bar */}
            {user && (
              <form
                className="d-flex align-items-center"
                onSubmit={handleSearch}
                style={{ gap: "0.5rem" }}
              >
                <input
                  className="form-control form-control-sm"
                  type="search"
                  placeholder="Search places"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    minWidth: "180px",
                    borderRadius: "2rem",
                    padding: "0.375rem 0.75rem",
                    border:
                      theme === "dark" ? "1px solid #555" : "1px solid #ccc",
                    backgroundColor: theme === "dark" ? "#222" : "#fff",
                    color: theme === "dark" ? "#f1f1f1" : "#212529",
                  }}
                />
                <button
                  className="btn"
                  type="submit"
                  style={{
                    backgroundColor: "#0d72b1ff",
                    border: "none",
                    color: "white",
                    fontWeight: "500",
                    padding: "6px 16px",
                    borderRadius: "10rem",
                    transition: "0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor = "#0646acff")
                  }
                >
                  Search
                </button>
              </form>
            )}

            {/* User Info */}
            {user && (
              <>
              <div className="user-info-name" style={{display:"flex", flexDirection:"column", alignContent:"flex-start"}}>
                <span
                  style={{ cursor: "pointer", background:"#3fbcea8c", padding:"8px 7px", borderRadius:"2rem"}}
                  className={`medium ${
                    theme === "dark" ? "text-light" : "text-dark"
                  }`}
                >
                  Username: {user.displayName || user.email}
                </span>
              </div>
                <button
                  style={{borderRadius: "10rem"}}
                  className="btn btn-sm btn-outline-danger"
                  onClick={onLogout}
                >
                  Logout
                </button>
              </>
            )}

            {/* Theme Toggle */}
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{borderRadius: "100%", display: "flex", alignItems: "center", justifyContent: "center"}}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;