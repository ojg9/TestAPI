const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const dbPath = "./db.json";

const app = express();
const PORT = 5001;
const SECRET = "secret123";

const tokenTiming = 100;

app.use(cors());
app.use(bodyParser.json());

function readDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Register
app.post("/api/v1/auth/register", (req, res) => {
  const {
    firstName,
    lastName,
    birthdate,
    email,
    phone,
    username,
    password,
    accountType,
  } = req.body;
  console.log(req.body);
  const db = readDB();

  const userExists = db.users.find((u) => u.username === username);
  if (userExists) return res.status(409).json({ message: "User exists" });

  const user = {
    id: Date.now(),
    firstName,
    lastName,
    birthdate,
    email,
    phone,
    username,
    password,
    accountType,
  };
  db.users.push(user);
  writeDB(db);

  const token = jwt.sign({ id: user.id, username }, SECRET, {
    expiresIn: `${tokenTiming}m`,
  });

  setTimeout(() => {
    res.status(201).json({
      id: user.id,
      username,
      accountType,
      token,
    });
  }, 1000);
});

// Login
app.post("/api/v1/auth/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  const user = db.users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username }, SECRET, {
    expiresIn: `${tokenTiming}m`,
  });

  res.json({
    token,
    user,
  });
});

// Logout
app.post("/api/v1/auth/logout", (req, res) => {
  res.json({ message: "Successfully logged out" });
});

// Refresh
app.post("/api/v1/auth/refresh", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const payload = jwt.verify(token, SECRET);
    const newToken = jwt.sign(
      { id: payload.id, username: payload.username },
      SECRET,
      { expiresIn: `${tokenTiming}m` }
    );
    res.json({ token: newToken });
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// Get user details
app.get("/api/v1/users/:id", (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id.toString() === req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, {
    expiresIn: `${tokenTiming}m`,
  });

  
  setTimeout(() => {
    res.status(200).json({
      user,
      token,
    });
  }, 1000);
});

// Get proposals based on location
app.get("/api/v1/map/contracts", (req, res) => {
  const db = readDB();

  console.log("Received request for proposals:", req.query);

  console.log("Database contents:", db);

  if (!db.proposals) {
    console.error("Proposals array is missing from database");
    return res
      .status(500)
      .json({ message: "Internal server error: No proposals data" });
  }

  console.log("Proposals sent :", db.proposals);
  res.json({ features: db.proposals });
});

app.listen(PORT, () => {
  console.log(`Auth API running on http://localhost:${PORT}`);
});
