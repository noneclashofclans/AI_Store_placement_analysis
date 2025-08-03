import React, { useState } from "react";
import axios from "axios";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../firebase";

const Login = () => {
  const [email, setemail] = useState("");
  const [password, setpassword] = useState("");
  const navigate = useNavigate();

  const login_user = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post(
        "https://ai-store-placement-analysis-express.onrender.com/login",
        {
          email,
          password,
        }
      );
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      alert("Login successful");
      alert(`Welcome ${response.data.user.email}`);
      alert(
        "Please refresh the home page after being redirected, to observe the changes."
      );
      navigate("/home");
    } catch (error) {
      console.error("Login error:", error);
      if (error.response?.status === 400) {
        alert("Invalid email or password");
      } else {
        alert("An error occurred. Please try again later.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      // Save to localStorage for consistency
      localStorage.setItem("user", JSON.stringify({ email }));
      alert(`Welcome ${email}`);
      navigate("/home");
    } catch (error) {
      console.error("Google sign-in error:", error);
      alert("Failed to sign in!");
    }
  };

  return (
    <div className="loginUser">
      <form className="login-form" onSubmit={login_user}>
        <h3 className="login-head">User login</h3>
        <input
          className="responsive-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setemail(e.target.value)}
          required
        />
        <input
          className="responsive-input"  
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setpassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        <p className="space">or</p>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Sign in with <FcGoogle size={25} />
        </button>
      </form>
    </div>
  );
};

export default Login;
