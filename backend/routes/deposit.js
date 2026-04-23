const express = require('express');
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
