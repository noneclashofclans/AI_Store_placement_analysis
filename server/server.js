// port already defined in the '.env' file
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");


dotenv.config();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes); // new auth route(can make any random)


app.get("/", (req, res) => {
    res.send("Hello World!");
});

// mongoDB connection starts----x-----
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});
// end-------x------

app.listen(process.env.PORT || 5000, () => {
    console.log(`Server is running on port ${process.env.PORT || 5000}`);
});  
