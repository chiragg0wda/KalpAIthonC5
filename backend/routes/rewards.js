const express = require('express');
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
