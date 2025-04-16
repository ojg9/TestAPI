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
    fs.writeFileSync(dbPath, JSON.stringify({ users: [], contracts: [] }, null, 2));
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

// Get contracts for a specific user with optional status filtering
app.get("/api/v1/users/:id/contracts", (req, res) => {
  const db = readDB();
  const { status } = req.query;
  const userId = parseInt(req.params.id);

  if (!db.proposals) {
    return res.status(500).json({ message: "Proposals data missing" });
  }

  let results = db.proposals.filter((p) => p.requesterId === userId);

  if (status) {
    results = results.filter((p) => p.contractStatus === status.toUpperCase());
  }

  res.json(results);
});

// Get single contract by ID
app.get("/api/v1/contracts/:id", (req, res) => {
  const db = readDB();
  const contractId = parseInt(req.params.id);

  const contract = db.proposals?.find((p) => p.contractId === contractId);

  if (!contract) {
    return res.status(404).json({ message: "Contract not found" });
  }

  res.json(contract);
});

// Update single contract by ID
app.put("/api/v1/contracts/:id", (req, res) => {
  const db = readDB();
  const contractId = parseInt(req.params.id);
  const index = db.proposals?.findIndex((p) => p.contractId === contractId);

  if (index === -1 || index === undefined) {
    return res.status(404).json({ message: "Contract not found" });
  }

  const contract = req.body;

  db.proposals[index] = {
    ...db.proposals[index],
    ...contract,
    contractId: contractId,
  };

  writeDB(db);

  res.json({ message: "Contract updated", contract: db.proposals[index] });
});

// Create new contract
app.post("/api/v1/contracts", (req, res) => {
  const db = readDB();
  const newContract = {
    ...req.body,
    contractId: Date.now(),
    creationDateTime: new Date().toISOString(),
  };

  if (!db.proposals) {
    db.proposals = [];
  }

  db.proposals.push(newContract);
  writeDB(db);

  res.status(201).json({ message: "Contract created", contract: newContract });
  const { lat, lng, filters } = req.query;

  // Convert `lat` and `lng` from strings to numbers
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  let contracts = db.contracts || [];

  if (filters) {
    const parsedFilters = JSON.parse(filters);
    contracts = contracts.filter(contract => {
      let matches = true;

      if (parsedFilters.radius !== undefined) {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = (contract.fromLocation.latitude - latitude) * (Math.PI / 180);
        const dLng = (contract.fromLocation.longitude - longitude) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(latitude * (Math.PI / 180)) * Math.cos(contract.fromLocation.latitude * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // Distance in kilometers
        matches = matches && distance <= parsedFilters.radius;
      }


      if (parsedFilters.price !== undefined) {
        matches = matches && contract.price <= parsedFilters.price;
      }

      if (parsedFilters.weight !== undefined) {
        matches = matches && contract.mass <= parsedFilters.weight;
      }
      if (parsedFilters.volume !== undefined) {
        matches = matches && contract.volume <= parsedFilters.volume;
      }
      if (parsedFilters.requiredPeople !== undefined) {
        matches = matches && contract.manPower >= parsedFilters.requiredPeople;
      }
      if (parsedFilters.fragile !== undefined) {
        matches = matches && contract.fragile === parsedFilters.fragile;
      }
      if (parsedFilters.coolingRequired !== undefined) {
        matches = matches && contract.coolingRequired === parsedFilters.coolingRequired;
      }
      if (parsedFilters.rideAlong !== undefined) {
        matches = matches && contract.rideAlong === parsedFilters.rideAlong;
      }
      if (parsedFilters.fromAddress !== undefined) {
        const [fromLat, fromLng] = parsedFilters.fromAddress.split(',');
        matches = matches && contract.fromLocation.latitude === parseFloat(fromLat) && contract.fromLocation.longitude === parseFloat(fromLng);
      }
      if (parsedFilters.toAddress !== undefined) {
        const [toLat, toLng] = parsedFilters.toAddress.split(',');
        matches = matches && contract.toLocation.latitude === parseFloat(toLat) && contract.toLocation.longitude === parseFloat(toLng);
      }
      if (parsedFilters.moveDateTime !== undefined) {
        matches = matches && contract.moveDateTime === parsedFilters.moveDateTime;
      }

      return matches;
    });
  }
  console.log("Returned contracts:", contracts);
  res.json({ contracts });
});

app.listen(PORT, () => {
  console.log(`Auth API running on http://localhost:${PORT}`);
});
