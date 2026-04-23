const express = require('express');
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
