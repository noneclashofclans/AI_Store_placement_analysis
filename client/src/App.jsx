import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import About from "./pages/About";
import Register from "./pages/Register";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import { ThemeProvider } from "./context/toggle_theme";
import ProtectedRoute from "./components/ProtectedRoute";

const AppContent = () => {
  const navigate = useNavigate();
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Firebase auth state listener (for Google sign-ins)
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.setItem("user", JSON.stringify(firebaseUser));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setUser(null);
      setSearchedLocation(null);
      alert("You have been logged out successfully");
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error logging out.");
    }
  };

  return (
    <div>
      <Navbar
        onLogout={handleLogout}
        user={user}
        setSearchedLocation={setSearchedLocation}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login setUser={setUser} />} />  
        <Route path="/register" element={<Register />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute user={user}>
              <Home searchedLocation={searchedLocation} user={user} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
};

const App = () => (
  <ThemeProvider>
    <Router>
      <div className="content">
        <AppContent />
      </div>
    </Router>
  </ThemeProvider>
);

export default App;