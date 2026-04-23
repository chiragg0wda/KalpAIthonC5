const express = require('express');
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
