import express from "express";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import "dotenv/config";

// --- Database Setup ---
// This sets up a simple JSON file as your database.
const adapter = new JSONFile("db.json");
const defaultData = { profiles: {} };
const db = new Low(adapter, defaultData);
await db.read(); // Load the database from the file

// --- File Upload Setup ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
// IMPORTANT: Update this with your frontend's live URL after you deploy it.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: FRONTEND_URL })); // Allow requests from your frontend
app.use(express.json()); // Allow the server to read JSON from request bodies

console.log("TrustPause Backend Service");

// --- API Endpoints ---

/**
 * GET /profile/:id
 * Retrieves the settings for a specific profile ID.
 */
app.get("/profile/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`[GET] /profile/${id}`);

  const profileData = db.data.profiles[id];

  if (profileData) {
    res.status(200).json(profileData);
  } else {
    // If no profile is found, send a 404 Not Found status.
    // The frontend will interpret this as a new user setup.
    res.status(404).json({ error: "Profile not found" });
  }
});

/**
 * POST /profile/:id
 * Creates or updates the settings for a specific profile ID.
 */
app.post("/profile/:id", async (req, res) => {
  const { id } = req.params;
  const newProfileData = req.body;
  console.log(`[POST] /profile/${id}`);

  // Save the data to the database
  db.data.profiles[id] = newProfileData;
  await db.write(); // Write the changes to the db.json file

  res.status(200).json({ success: true, data: newProfileData });
});

/**
 * DELETE /profile/:id
 * Deletes a profile.
 */
app.delete("/profile/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`[DELETE] /profile/${id}`);

  if (db.data.profiles[id]) {
    delete db.data.profiles[id];
    await db.write();
    res.status(204).send(); // 204 No Content is standard for a successful delete
  } else {
    // If the profile doesn't exist, the client's goal (it being gone) is achieved.
    // Sending a 204 here is simple and effective.
    res.status(204).send();
  }
});

/**
 * POST /analyze-image
 * Analyzes an uploaded image for AI generation using Hive AI.
 */
app.post("/analyze-image", upload.single("image"), async (req, res) => {
  console.log("[POST] /analyze-image");
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  const HIVE_API_KEY = process.env.HIVE_AI_API_KEY;
  if (!HIVE_API_KEY) {
    return res.status(500).json({ error: "AI detection service is not configured on the server." });
  }

  try {
    const form = new FormData();
    form.append("media", req.file.buffer, { filename: req.file.originalname });

    const response = await axios.post("https://api.thehive.ai/api/v2/task/sync", form, {
      headers: {
        ...form.getHeaders(),
        authorization: `token ${HIVE_API_KEY}`,
      },
    });

    // Find the score for the 'ai_generated_image' class
    const aiClass = response.data.status[0]?.response.output[0]?.classes.find(
      (c) => c.class === "ai_generated_image"
    );

    res.status(200).json({ success: true, score: aiClass?.score || 0 });
  } catch (error) {
    console.error("Error analyzing image:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to analyze image." });
  }
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Add a simple root endpoint for health checks
app.get("/", (req, res) => {
  res.send("TrustPause API is healthy!");
});