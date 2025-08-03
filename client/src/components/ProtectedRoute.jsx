import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);

  useEffect(() => {
    // Check Firebase auth
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setFirebaseUser(currentUser);
      setJwtToken(localStorage.getItem("token")); 
      setIsAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  if (!isAuthChecked) return null;

  return firebaseUser || jwtToken ? children : <Navigate to="/" />;
};

export default ProtectedRoute;
