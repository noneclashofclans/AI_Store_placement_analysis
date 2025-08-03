import React from "react";
import "./About.css";
import useTheme from "../context/useTheme"; 
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

const About = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className={`about-page ${theme}`}>
      <div className="about-hero">
        <h1>About <span className="highlight" onClick={() => navigate('/')}>'Place-it!'</span></h1>
        <p style={{"marginBottom":"10vh"}}>Smart and intuitive store placement system.</p>
      </div>

      <div className="about-section">
        <div className="about-text">
          <h2>About Me!</h2>
          <p style={{marginBottom: "10vh"}}>
            I'm <b>Rishit Mohanty</b>, a passionate <b>MERN Stack developer</b> with a keen interest in building smart solutions for everyday problems. This project is a testament to my dedication to creating user-friendly applications that leverage modern technology.
          </p>

          <h2>What Does This Website Do?</h2>
          <p>
            This website is designed to help <b>MNC's </b>, <b>E-commerce startups</b> and <b>private firms</b>, find the best places for placing their e-shops, whether it's shopping, dining, retail etc. Thanks to the advanced Machine Learning algorithms, we are able to analyze user's choice of placing the store and provide personalized recommendations.
          </p>
        </div>

        <div className="about-image">
          <img className = "photo" src="/photo.jpg" alt="Smart Tech" />
        </div>
      </div>
      <h4 style={{display:"flex", alignItems:"center", justifyContent:"center","margin-top":"18vh", "text-decoration":"underline"}}>Connect with me on:</h4>
      <Footer></Footer>
    </div>
  );
};

export default About;
