const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require('path');
const { MinHeap, Trie, Graph } = require('./dsa'); // Import DSA classes

const app = express();

// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://esports-62899-default-rtdb.firebaseio.com',
});

// CORS setup
const allowedLocalhost = [/^http:\/\/(localhost)(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedLocalhost.some((re) => re.test(origin))) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve frontend statically
const frontendPath = path.join(__dirname, '..', 'esports-management');
app.use(express.static(frontendPath));

// Test route
app.get("/test-cors", (req, res) => {
  res.json({ message: "CORS is working!", origin: req.headers.origin });
});

// Firebase Authentication middleware
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const idToken = authHeader.split(" ")[1];
  
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Sync profile route
app.post("/api/auth/sync-profile", verifyToken, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role is required" });

    const rtdb = admin.database();
    const profileRef = rtdb.ref('users/' + req.user.uid);
    
    const updates = {
      email: req.user.email || null,
      role: role,
      score: 0,
      createdAt: admin.database.ServerValue.TIMESTAMP
    };
    
    const { fullName, displayName, phone } = req.body;
    if (fullName) updates.fullName = fullName;
    if (displayName) updates.displayName = displayName;
    if (phone) updates.phone = phone;

    await profileRef.update(updates);
    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile
app.get('/api/user', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const snapshot = await admin.database().ref('users/' + uid).once('value');
    const data = snapshot.val();
    
    if (!data) return res.status(404).json({ error: 'Profile not found' });
    
    res.json({ uid, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Firebase Auth users (admin only)
app.get('/api/auth/users', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const profileSnap = await admin.database().ref('users/' + uid).once('value');
    const profile = profileSnap.val();
    if (!profile || profile.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { nextPageToken } = req.query;
    const result = await admin.auth().listUsers(1000, nextPageToken);
    
    const users = result.users.map(u => ({ 
      uid: u.uid,
      email: u.email,
      disabled: u.disabled
    }));
    
    res.json({ users, nextPageToken: result.pageToken || null });
  } catch (err) {
    console.error('Failed to list auth users', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Firebase Auth user (admin only)
app.delete('/api/auth/user/:uid', verifyToken, async (req, res) => {
  try {
    const requesterUid = req.user.uid;
    const profileSnap = await admin.database().ref('users/' + requesterUid).once('value');
    const profile = profileSnap.val();
    if (!profile || profile.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { uid } = req.params;
    
    await admin.auth().deleteUser(uid);
    await admin.database().ref('users/' + uid).remove();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete auth user', err);
    res.status(500).json({ error: err.message });
  }
});

// Reports API
app.post("/api/reports", (req, res) => {
  const { reportType } = req.body;

  const sampleData = {
    player: [
      { id: 1, username: 'PlayerOne', matches: 20, wins: 15, winRate: 75 },
      { id: 2, username: 'PlayerTwo', matches: 25, wins: 10, winRate: 40 },
      { id: 3, username: 'PlayerThree', matches: 30, wins: 25, winRate: 83 },
    ],
    tournament: [
      { id: 1, name: 'Summer Showdown', game: 'Valorant', status: 'Completed' },
      { id: 2, name: 'Winter Classic', game: 'League of Legends', status: 'Upcoming' },
    ],
    match: [
      { id: 1, tournament: 'Summer Showdown', teams: 'Team A vs Team B', status: 'Completed', result: 'Team A Win' },
      { id: 2, tournament: 'Winter Classic', teams: 'Team C vs Team D', status: 'Scheduled', result: 'Pending' },
    ]
  };

  const data = sampleData[reportType] || [];
  res.json(data);
});

// Team endpoints
app.post('/api/team', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.name) return res.status(400).json({ error: 'team payload missing or name empty' });
    const rtdb = admin.database();
    const ref = rtdb.ref('Team').push();
    await ref.set(payload);
    res.json({ success: true, key: ref.key });
  } catch (err) {
    console.error('Server failed to write team to RTDB', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/team', async (req, res) => {
  try {
    const snapshot = await admin.database().ref('Team').once('value');
    res.json(snapshot.val() || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Player endpoints
app.post('/api/players', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.username) return res.status(400).json({ error: 'player payload missing or username empty' });
    const rtdb = admin.database();
    const ref = rtdb.ref('players').push();
    await ref.set(payload);
    res.json({ success: true, key: ref.key });
  } catch (err) {
    console.error('Server failed to write player to RTDB', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/players', async (req, res) => {
  try {
    const snapshot = await admin.database().ref('players').once('value');
    res.json(snapshot.val() || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Match endpoints
app.post('/api/match', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.tournament_id) return res.status(400).json({ error: 'match payload missing or tournament_id empty' });
    const rtdb = admin.database();
    const ref = rtdb.ref('Match').push();
    await ref.set(payload);
    res.json({ success: true, key: ref.key });
  } catch (err) {
    console.error('Server failed to write match to RTDB', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/match', async (req, res) => {
  try {
    const snapshot = await admin.database().ref('Match').once('value');
    res.json(snapshot.val() || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/match/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'missing match key' });
    await admin.database().ref('Match/' + key).remove();
    res.json({ success: true });
  } catch (err) {
    console.error('Server failed to delete match', err);
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard API using MinHeap DSA
app.get("/api/leaderboard", async (req, res) => {
  try {
    const { limit = 10, sortBy = 'rating' } = req.query;
    
    // Fetch players data from Firebase
    const snapshot = await admin.database().ref('players').once('value');
    const playersData = snapshot.val() || {};
    
    // Create MinHeap for efficient leaderboard management
    const leaderboardHeap = new MinHeap();
    const players = [];
    
    // Process players data and insert into heap
    Object.keys(playersData).forEach(playerId => {
      const playerData = playersData[playerId];
      if (playerData && playerData.avg_rating) {
        const player = {
          id: playerId,
          username: playerData.username || 'Unknown Player',
          email: playerData.email || '',
          rating: Math.round(playerData.avg_rating * 100), // Convert to integer
          matchesPlayed: playerData.matches_played || 0,
          wins: playerData.wins || 0,
          losses: playerData.losses || 0,
          kills: playerData.kills || 0,
          deaths: playerData.deaths || 0,
          joinDate: playerData.join_date || '',
          role: playerData.role || 'player',
          game: playerData.game || 'Dota 2'
        };
        
        // Insert into MinHeap (we'll use negative rating for max-heap behavior)
        leaderboardHeap.insert({ ...player, heapRating: -player.rating });
        players.push(player);
      }
    });
    
    // Extract top players from heap
    const topPlayers = [];
    const heapSize = Math.min(leaderboardHeap.heap.length, parseInt(limit));
    
    for (let i = 0; i < heapSize; i++) {
      const playerData = leaderboardHeap.extractMin();
      if (playerData) {
        // Restore original rating (remove negative)
        playerData.rating = -playerData.heapRating;
        delete playerData.heapRating;
        topPlayers.push(playerData);
      }
    }
    
    // Sort by requested criteria
    topPlayers.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'matches':
          return b.matchesPlayed - a.matchesPlayed;
        case 'wins':
          return b.wins - a.wins;
        case 'kills':
          return b.kills - a.kills;
        default:
          return b.rating - a.rating;
      }
    });
    
    res.json({
      success: true,
      leaderboard: topPlayers,
      totalPlayers: players.length,
      sortBy: sortBy,
      limit: parseInt(limit)
    });
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch leaderboard data' 
    });
  }
});

// Update player rating API (for real-time leaderboard updates)
app.post("/api/leaderboard/update-rating", async (req, res) => {
  try {
    const { playerId, newRating, matchResult } = req.body;
    
    if (!playerId || newRating === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Player ID and new rating are required' 
      });
    }
    
    // Update player data in Firebase
    const playerRef = admin.database().ref(`players/${playerId}`);
    const snapshot = await playerRef.once('value');
    const playerData = snapshot.val();
    
    if (!playerData) {
      return res.status(404).json({ 
        success: false,
        error: 'Player not found' 
      });
    }
    
    // Update player statistics
    const updates = {
      avg_rating: newRating / 100, // Convert back to decimal
      matches_played: (playerData.matches_played || 0) + 1,
      last_updated: new Date().toISOString()
    };
    
    if (matchResult === 'win') {
      updates.wins = (playerData.wins || 0) + 1;
    } else if (matchResult === 'loss') {
      updates.losses = (playerData.losses || 0) + 1;
    }
    
    await playerRef.update(updates);
    
    res.json({
      success: true,
      message: 'Player rating updated successfully',
      playerId: playerId,
      newRating: newRating
    });
    
  } catch (error) {
    console.error('Update rating error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update player rating' 
    });
  }
});

// Player search with Trie
app.get("/api/search/:prefix", async (req, res) => {
  try {
    const { prefix } = req.params;
    
    const snapshot = await admin.database().ref('users').once('value');
    const usersData = snapshot.val() || {};
    
    const trie = new Trie();
    const players = [];
    
    Object.keys(usersData).forEach(uid => {
      const user = usersData[uid];
      if (user.email) {
        const username = user.email.split("@")[0];
        trie.insert(username);
        
        players.push({
          uid: uid,
          email: user.email,
          username: username,
          role: user.role || 'unknown',
          fullName: user.fullName || ''
        });
      }
    });
    
    const matchingUsernames = trie.search(prefix);
    const matchingPlayers = players.filter(player => 
      matchingUsernames.includes(player.username)
    );
    
    res.json({
      prefix: prefix,
      matches: matchingPlayers,
      count: matchingPlayers.length
    });
    
  } catch (err) {
    console.error('Player search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));