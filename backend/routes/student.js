const express = require('express');
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
