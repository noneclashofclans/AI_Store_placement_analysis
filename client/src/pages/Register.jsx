import React, { useState } from 'react'
import axios from 'axios'
import './Register.css'
import { useNavigate } from 'react-router-dom'

const Register = () => {
  const [password, setpassword] = useState('');
  const [email, setemail] = useState("");
  const navigate = useNavigate();

  const register_user = async (e) => {
    e.preventDefault();

    if (!password || !email) {
      alert("Please fill in all fields");
      return; 
    }
    try {
      await axios.post("https://place-it-backend.onrender.com/register", {
        email,
        password,
      });
      alert("Registration successful, kindly login.");
      navigate("/login");
    } catch (error) {
      console.error("Registration error:", error);
      alert("You have already registered previously with the following credentials. Kindly login");
      navigate('/login');
    }
    setemail("");
    setpassword("");
  }

  return (
    <>
      <div className="auth">
        <h2 className='reg'>Register</h2>
        <form className='register-form'>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            onChange = {(e) => setemail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setpassword(e.target.value)}
            required
          />
          <button type="submit" onClick={register_user}>Submit</button>

        <p className="oldUser-below">
          Existing user?{" "}
          <span
            className="meme"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
      </p>
        </form>
      </div>
    </>
  )
}

export default Register
