import React from "react";
import { FaGithub, FaLinkedin, FaEnvelope } from "react-icons/fa";

const Footer = () => {
  return (
    <div
      style={{
        display: "flex",
        gap: "48px",
        alignItems: "center",
        marginBottom: "18px",
        justifyContent: "center",
      }}
    >
      <a
        href="https://github.com/noneclashofclans"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <FaGithub size={38} style={{ color: "purple" }}/>
      </a>
      <a
        href="https://www.linkedin.com/in/rishit-mohanty-620bbb284/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
      >
        <FaLinkedin size={38} style={{ color: "#0077b5" }} />
      </a>
      <a href="mailto:rishitmohanty3@gmail.com" aria-label="Email">
        <FaEnvelope size={38} style={{ color: "#c71610" }} />
      </a>
    </div>
  );
};

export default Footer;
