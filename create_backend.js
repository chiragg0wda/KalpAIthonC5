const fs = require('fs');
const path = require('path');

const base = 'backend';

// Create directories
['routes', 'models', 'middleware', 'utils'].forEach(d => {
    fs.mkdirSync(path.join(base, d), { recursive: true });
});
console.log('Directories created');

// Helper
function write(filePath, content) {
    fs.writeFileSync(path.join(base, filePath), content, 'utf8');
    console.log('Created:', filePath);
}

// ── .env ─────────────────────────────────────────────────
write('.env',
    `PORT=5000
MONGO_URI=mongodb://localhost:27017/bin2coin
JWT_SECRET=bin2coin_super_secret_2024
ADMIN_PASSWORD=admin123
OLLAMA_URL=http://localhost:11434
`);

// ── package.json ──────────────────────────────────────────
write('package.json', JSON.stringify({
    name: "bin2coin-backend",
    version: "1.0.0",
    description: "BIN2COIN Smart Waste Management Backend",
    main: "server.js",
    scripts: { start: "node server.js", dev: "nodemon server.js" },
    dependencies: {
        cors: "^2.8.5",
        dotenv: "^16.3.1",
        express: "^4.18.2",
        jsonwebtoken: "^9.0.2",
        mongoose: "^7.6.3",
        "node-fetch": "^2.7.0",
        "socket.io": "^4.6.1"
    },
    devDependencies: { nodemon: "^3.0.1" }
}, null, 2));

// ── utils/constants.js ────────────────────────────────────
write('utils/constants.js',
    `module.exports = {
  MIN_WEIGHT: 20,
  SESSION_DELAY: 5000,
  MAX_BIN_CAPACITY: 5000,
  MAX_SINGLE_DEPOSIT: 2000,
  MATERIAL_MULTIPLIERS: {
    plastic: 2.0,
    metal:   3.0,
    paper:   1.5,
    general: 1.0
  }
};
`);

// ── utils/validation.js ───────────────────────────────────
write('utils/validation.js',
    `function normalizeUID(uid) {
  if (!uid) return '';
  return uid.replace(/\\s/g, '').toUpperCase();
}
module.exports = { normalizeUID };
`);

// ── utils/classify.js ─────────────────────────────────────
write('utils/classify.js',
    `const fetch = require('node-fetch');

const VALID_MATERIALS = ['plastic', 'metal', 'paper', 'general'];

async function classifyWaste(base64Image) {
  if (!base64Image || typeof base64Image !== 'string' || base64Image.length < 100) {
    console.log('[AI] No valid image, defaulting to general');
    return 'general';
  }
  const prompt = \`Look at this image of waste or garbage placed in a bin.
Classify it into exactly one of these four categories:
- plastic (bottles, bags, plastic containers, packaging, wrappers)
- metal (cans, tins, aluminium foil, metal objects)
- paper (cardboard, newspapers, books, paper bags, cartons)
- general (food waste, mixed waste, unidentifiable, anything else)
Reply with exactly one word in lowercase only. No punctuation. No explanation.\`;

  try {
    const response = await fetch(\`\${process.env.OLLAMA_URL}/api/generate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llava', prompt, images: [base64Image], stream: false }),
      timeout: 12000
    });
    if (!response.ok) throw new Error(\`Ollama HTTP \${response.status}\`);
    const data = await response.json();
    const raw = (data.response || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (VALID_MATERIALS.includes(raw)) { console.log('[AI] Classified:', raw); return raw; }
    for (const mat of VALID_MATERIALS) { if (raw.includes(mat)) return mat; }
    console.log('[AI] Unknown response, defaulting to general');
    return 'general';
  } catch (err) {
    console.error('[AI] Failed (using general):', err.message);
    return 'general';
  }
}

module.exports = { classifyWaste };
`);

// ── middleware/auth.js ────────────────────────────────────
write('middleware/auth.js',
    `const jwt = require('jsonwebtoken');

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function studentAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    req.student = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { adminAuth, studentAuth };
`);

// ── models/User.js ────────────────────────────────────────
write('models/User.js',
    `const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  rfid_uid:   { type: String, required: true, unique: true, uppercase: true, trim: true },
  pin:        { type: String, default: '1234' },
  points:     { type: Number, default: 0 },
  totalWaste: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema);
`);

// ── models/Bin.js ─────────────────────────────────────────
write('models/Bin.js',
    `const mongoose = require('mongoose');
const binSchema = new mongoose.Schema({
  _id:           { type: String },
  name:          { type: String, required: true },
  currentWeight: { type: Number, default: 0 },
  maxCapacity:   { type: Number, default: 5000 },
  isFull:        { type: Boolean, default: false }
});
module.exports = mongoose.model('Bin', binSchema);
`);

// ── models/Transaction.js ─────────────────────────────────
write('models/Transaction.js',
    `const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String },
  weight:    { type: Number, default: 0 },
  material:  { type: String, default: 'general' },
  points:    { type: Number },
  binId:     { type: String },
  timestamp: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Transaction', transactionSchema);
`);

// ── models/Reward.js ──────────────────────────────────────
write('models/Reward.js',
    `const mongoose = require('mongoose');
const rewardSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  cost:        { type: Number, required: true },
  stock:       { type: Number, default: -1 }
});
module.exports = mongoose.model('Reward', rewardSchema);
`);

// ── models/RegistrationSession.js ────────────────────────
write('models/RegistrationSession.js',
    `const mongoose = require('mongoose');
const registrationSessionSchema = new mongoose.Schema({
  uid:       { type: String, default: null },
  createdAt: { type: Date, default: Date.now, expires: 120 }
});
module.exports = mongoose.model('RegistrationSession', registrationSessionSchema);
`);

// ── routes/auth.js ────────────────────────────────────────
write('routes/auth.js',
    `const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

router.post('/student-login', async (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
  try {
    const user = await User.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } });
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (user.pin !== pin) return res.status(401).json({ error: 'INVALID_PIN' });
    const token = jwt.sign(
      { role: 'student', userId: user._id.toString(), name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({ token, user: { _id: user._id, name: user.name, points: user.points, totalWaste: user.totalWaste } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`);

// ── routes/scan.js ────────────────────────────────────────
write('routes/scan.js',
    `const express = require('express');
const router = express.Router();
const { normalizeUID } = require('../utils/validation');
const RegistrationSession = require('../models/RegistrationSession');
const User = require('../models/User');
const Bin = require('../models/Bin');

router.post('/', async (req, res) => {
  let { uid, binId } = req.body;
  if (!uid || !binId) return res.status(200).json({ status: 'ERROR', message: 'MISSING_FIELDS' });
  uid = normalizeUID(uid);
  try {
    const session = await RegistrationSession.findOne({});
    if (session && session.uid === null) {
      session.uid = uid;
      await session.save();
      return res.status(200).json({ status: 'REGISTER_MODE', uid });
    }
    const user = await User.findOne({ rfid_uid: uid });
    if (!user) return res.status(200).json({ status: 'ERROR', message: 'USER_NOT_FOUND' });
    const bin = await Bin.findById(binId);
    if (!bin) return res.status(200).json({ status: 'ERROR', message: 'BIN_NOT_FOUND' });
    if (bin.isFull) return res.status(200).json({ status: 'ERROR', message: 'BIN_FULL' });
    return res.status(200).json({ status: 'OK', message: 'START_DEPOSIT', userName: user.name, points: user.points });
  } catch (err) {
    console.error('Scan error:', err);
    return res.status(200).json({ status: 'ERROR', message: 'SERVER_ERROR' });
  }
});

module.exports = router;
`);

// ── routes/deposit.js ─────────────────────────────────────
write('routes/deposit.js',
    `const express = require('express');
const router = express.Router();
const { normalizeUID } = require('../utils/validation');
const { classifyWaste } = require('../utils/classify');
const { MIN_WEIGHT, MAX_SINGLE_DEPOSIT, MATERIAL_MULTIPLIERS, MAX_BIN_CAPACITY } = require('../utils/constants');
const User = require('../models/User');
const Bin = require('../models/Bin');
const Transaction = require('../models/Transaction');

router.post('/', async (req, res) => {
  try {
    const weight = parseFloat(req.body.weight);
    if (isNaN(weight) || weight <= 0) return res.status(200).json({ status: 'ERROR', message: 'INVALID_WEIGHT' });
    if (weight < MIN_WEIGHT) return res.status(200).json({ status: 'ERROR', message: 'TOO_LIGHT' });
    if (weight > MAX_SINGLE_DEPOSIT) return res.status(200).json({ status: 'ERROR', message: 'TOO_HEAVY' });

    const uid = normalizeUID(req.body.uid);
    const user = await User.findOne({ rfid_uid: uid });
    if (!user) return res.status(200).json({ status: 'ERROR', message: 'USER_NOT_FOUND' });

    const bin = await Bin.findById(req.body.binId);
    if (!bin) return res.status(200).json({ status: 'ERROR', message: 'BIN_NOT_FOUND' });
    if (bin.isFull) return res.status(200).json({ status: 'ERROR', message: 'BIN_FULL' });

    const material = await classifyWaste(req.body.image || '');
    const multiplier = MATERIAL_MULTIPLIERS[material] || 1.0;
    const points = Math.round(weight * multiplier);

    user.points += points;
    user.totalWaste += weight;
    await user.save();

    const transaction = await Transaction.create({
      userId: user._id, userName: user.name,
      weight, material, points, binId: req.body.binId
    });

    bin.currentWeight += weight;
    if (bin.currentWeight >= bin.maxCapacity) bin.isFull = true;
    await bin.save();

    const binFill = parseFloat(((bin.currentWeight / bin.maxCapacity) * 100).toFixed(1));
    const io = req.app.get('io');
    io.emit('newDeposit', { userName: user.name, weight, material, points, binId: req.body.binId, binFill, timestamp: transaction.timestamp });

    return res.status(200).json({ status: 'OK', points, material, totalPoints: user.points, userName: user.name });
  } catch (err) {
    console.error('Deposit error:', err);
    return res.status(200).json({ status: 'ERROR', message: 'SERVER_ERROR' });
  }
});

module.exports = router;
`);

// ── routes/register.js ────────────────────────────────────
write('routes/register.js',
    `const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const RegistrationSession = require('../models/RegistrationSession');

router.post('/start', adminAuth, async (req, res) => {
  try {
    await RegistrationSession.deleteMany({});
    await RegistrationSession.create({ uid: null });
    res.status(200).json({ status: 'OK', message: 'WAITING_FOR_SCAN' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/pending', adminAuth, async (req, res) => {
  try {
    const session = await RegistrationSession.findOne({});
    if (!session) return res.status(200).json({ uid: null, armed: false });
    res.status(200).json({ uid: session.uid, armed: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`);

// ── routes/users.js ───────────────────────────────────────
write('routes/users.js',
    `const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { normalizeUID } = require('../utils/validation');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const RegistrationSession = require('../models/RegistrationSession');

router.post('/register', adminAuth, async (req, res) => {
  const { name, rfid_uid, pin } = req.body;
  if (!name || !rfid_uid) return res.status(400).json({ error: 'Name and RFID UID required' });
  const normalizedUid = normalizeUID(rfid_uid);
  try {
    if (await User.findOne({ rfid_uid: normalizedUid })) return res.status(400).json({ error: 'RFID_ALREADY_REGISTERED' });
    if (await User.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } })) return res.status(400).json({ error: 'NAME_TAKEN' });
    const newUser = await User.create({ name: name.trim(), rfid_uid: normalizedUid, pin: pin || '1234' });
    await RegistrationSession.deleteMany({});
    const io = req.app.get('io');
    io.emit('userRegistered', { user: { _id: newUser._id, name: newUser.name, points: 0 } });
    const obj = newUser.toObject(); delete obj.pin;
    res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/lookup', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(200).json([]);
  try {
    const users = await User.find({ name: { $regex: name.trim(), $options: 'i' } }).limit(5).select('name points totalWaste createdAt');
    const totalUsers = await User.countDocuments();
    const results = await Promise.all(users.map(async (u) => {
      const rank = (await User.countDocuments({ points: { $gt: u.points } })) + 1;
      return { name: u.name, points: u.points, totalWaste: u.totalWaste, rank, totalUsers };
    }));
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find({}).select('-pin').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Transaction.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`);

// ── routes/admin.js ───────────────────────────────────────
write('routes/admin.js',
    `const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const User = require('../models/User');
const Bin = require('../models/Bin');
const Transaction = require('../models/Transaction');

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const wasteAgg  = await Transaction.aggregate([{ $match: { weight: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$weight' } } }]);
    const pointsAgg = await Transaction.aggregate([{ $match: { points: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$points' } } }]);
    const totalWaste  = wasteAgg[0]?.total  || 0;
    const totalPoints = pointsAgg[0]?.total || 0;
    const bins = await Bin.find({});
    const activeBins = bins.filter(b => !b.isFull).length;
    const leaderboard = await User.find({}).sort({ points: -1 }).limit(10).select('name points totalWaste');
    const recentTransactions = await Transaction.find({}).sort({ timestamp: -1 }).limit(10);
    res.status(200).json({ totalUsers, totalWaste, totalPoints, activeBins, bins, leaderboard, recentTransactions });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bins/reset/:binId', adminAuth, async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.binId);
    if (!bin) return res.status(404).json({ error: 'Bin not found' });
    bin.currentWeight = 0; bin.isFull = false;
    await bin.save();
    const io = req.app.get('io');
    io.emit('binReset', { binId: req.params.binId });
    res.status(200).json({ status: 'OK', bin });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`);

// ── routes/rewards.js ─────────────────────────────────────
write('routes/rewards.js',
    `const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const Reward = require('../models/Reward');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

router.get('/', async (req, res) => {
  try {
    res.status(200).json(await Reward.find({}).sort({ cost: 1 }));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', adminAuth, async (req, res) => {
  const { name, description, cost, stock } = req.body;
  if (!name || !cost) return res.status(400).json({ error: 'Name and cost required' });
  try {
    const reward = await Reward.create({ name, description: description || '', cost: Number(cost), stock: stock !== undefined ? Number(stock) : -1 });
    res.status(201).json(reward);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Reward.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Reward deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/redeem', adminAuth, async (req, res) => {
  const { userId, rewardId } = req.body;
  if (!userId || !rewardId) return res.status(400).json({ error: 'userId and rewardId required' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const reward = await Reward.findById(rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    if (user.points < reward.cost) return res.status(400).json({ error: 'INSUFFICIENT_POINTS', needed: reward.cost, have: user.points });
    if (reward.stock === 0) return res.status(400).json({ error: 'OUT_OF_STOCK' });
    user.points -= reward.cost; await user.save();
    if (reward.stock > 0) { reward.stock -= 1; await reward.save(); }
    await Transaction.create({ userId: user._id, userName: user.name, weight: 0, material: 'redemption', points: -(reward.cost), binId: 'REDEMPTION' });
    const io = req.app.get('io');
    io.emit('rewardRedeemed', { userName: user.name, rewardName: reward.name, pointsSpent: reward.cost, newBalance: user.points });
    res.status(200).json({ status: 'OK', newPoints: user.points, rewardName: reward.name });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`);

// ── routes/transactions.js ────────────────────────────────
write('routes/transactions.js',
    `const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

router.get('/', adminAuth, async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;
    const transactions = await Transaction.find({}).sort({ timestamp: -1 }).skip(skip).limit(limit);
    const total = await Transaction.countDocuments();
    res.status(200).json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`);

// ── routes/student.js ─────────────────────────────────────
write('routes/student.js',
    `const express = require('express');
const router = express.Router();
const { studentAuth } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');

router.get('/me', studentAuth, async (req, res) => {
  try {
    const user = await User.findById(req.student.userId).select('-pin -rfid_uid');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const rank = (await User.countDocuments({ points: { $gt: user.points } })) + 1;
    const totalUsers = await User.countDocuments();
    const recentTransactions = await Transaction.find({ userId: req.student.userId }).sort({ timestamp: -1 }).limit(10);
    const rewards = await Reward.find({}).sort({ cost: 1 });
    const rewardsWithAffordable = rewards.map(r => ({ ...r.toObject(), canAfford: user.points >= r.cost }));
    res.status(200).json({ name: user.name, points: user.points, totalWaste: user.totalWaste, rank, totalUsers, recentTransactions, rewards: rewardsWithAffordable });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/leaderboard', studentAuth, async (req, res) => {
  try {
    const student = await User.findById(req.student.userId).select('points');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const leaderboard = await User.find({}).sort({ points: -1 }).limit(20).select('name points totalWaste');
    const myRank = (await User.countDocuments({ points: { $gt: student.points } })) + 1;
    res.status(200).json({ leaderboard, myRank });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

const publicLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.find({}).sort({ points: -1 }).limit(20).select('name points totalWaste');
    res.status(200).json(leaderboard);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

module.exports = router;
module.exports.publicLeaderboard = publicLeaderboard;
`);

// ── server.js ─────────────────────────────────────────────
write('server.js',
    `const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
require('dotenv').config();

const User        = require('./models/User');
const Bin         = require('./models/Bin');
const Reward      = require('./models/Reward');
const Transaction = require('./models/Transaction');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], methods: ['GET', 'POST', 'DELETE', 'PUT'] }
});

app.set('io', io);
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/scan',         require('./routes/scan'));
app.use('/api/deposit',      require('./routes/deposit'));
app.use('/api/register',     require('./routes/register'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/rewards',      require('./routes/rewards'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/student',      require('./routes/student'));

const { publicLeaderboard } = require('./routes/student');
app.get('/api/leaderboard', publicLeaderboard);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Client disconnected:', socket.id));
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('[DB] MongoDB connected');
    await seedDefaultData();
    server.listen(process.env.PORT || 5000, () => {
      console.log('[Server] Running on port', process.env.PORT || 5000);
      console.log('[Server] Admin password:', process.env.ADMIN_PASSWORD);
    });
  })
  .catch(err => { console.error('[DB] Connection failed:', err.message); process.exit(1); });

async function seedDefaultData() {
  if (!await Bin.findById('BIN_1')) {
    await Bin.create({ _id: 'BIN_1', name: 'Dustbin-A', currentWeight: 0, maxCapacity: 5000, isFull: false });
    console.log('[Seed] Default bin created');
  }
  if (await Reward.countDocuments() === 0) {
    await Reward.insertMany([
      { name: 'Free Canteen Meal',    description: 'Redeem for 1 free canteen meal',         cost: 500, stock: -1 },
      { name: 'Stationery Kit',       description: 'Pen, pencil, eraser set',                 cost: 300, stock: 10 },
      { name: 'Extra Library Day',    description: '1 extra borrowing day for library books',  cost: 200, stock: -1 },
      { name: 'School Store Voucher', description: '₹50 voucher at the school store',          cost: 750, stock: 20 },
      { name: 'Eco Warrior Badge',    description: 'Digital badge + certificate',              cost: 100, stock: -1 }
    ]);
    console.log('[Seed] Default rewards created');
  }
  if (await User.countDocuments() === 0) {
    const fakeUsers = [
      { name: 'Sneha R',     rfid_uid: 'FAKE000001', pin: '0000', points: 2100, totalWaste: 1050 },
      { name: 'Karan M',     rfid_uid: 'FAKE000002', pin: '0000', points: 1850, totalWaste: 920  },
      { name: 'Divya S',     rfid_uid: 'FAKE000003', pin: '0000', points: 1600, totalWaste: 800  },
      { name: 'Aditya P',    rfid_uid: 'FAKE000004', pin: '0000', points: 1400, totalWaste: 700  },
      { name: 'Meera K',     rfid_uid: 'FAKE000005', pin: '0000', points: 1200, totalWaste: 650  },
      { name: 'Rohan V',     rfid_uid: 'FAKE000006', pin: '0000', points: 980,  totalWaste: 490  },
      { name: 'Ananya T',    rfid_uid: 'FAKE000007', pin: '0000', points: 820,  totalWaste: 410  },
      { name: 'Vikram N',    rfid_uid: 'FAKE000008', pin: '0000', points: 650,  totalWaste: 325  },
      { name: 'Pooja L',     rfid_uid: 'FAKE000009', pin: '0000', points: 500,  totalWaste: 250  },
      { name: 'Siddharth A', rfid_uid: 'FAKE000010', pin: '0000', points: 300,  totalWaste: 150  }
    ];
    await User.insertMany(fakeUsers);
    console.log('[Seed] Demo users created');

    const materials   = ['plastic', 'metal', 'paper', 'general'];
    const multipliers = { plastic: 2, metal: 3, paper: 1.5, general: 1 };
    const seededUsers = await User.find({ rfid_uid: /^FAKE/ });
    const fakeTx      = [];
    seededUsers.forEach(u => {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const mat      = materials[Math.floor(Math.random() * materials.length)];
        const wt       = 100 + Math.floor(Math.random() * 400);
        const pts      = Math.round(wt * multipliers[mat]);
        const hoursAgo = Math.floor(Math.random() * 72);
        fakeTx.push({ userId: u._id, userName: u.name, weight: wt, material: mat, points: pts, binId: 'BIN_1', timestamp: new Date(Date.now() - hoursAgo * 3600000) });
      }
    });
    await Transaction.insertMany(fakeTx);
    console.log('[Seed]', fakeTx.length, 'demo transactions created');
  }
}
`);

console.log('\n✅ ALL BACKEND FILES CREATED SUCCESSFULLY!');
console.log('\nNext steps:');
console.log('  cd backend');
console.log('  npm install');
console.log('  npm run dev');