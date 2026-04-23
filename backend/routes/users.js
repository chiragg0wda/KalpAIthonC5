const express = require('express');
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
