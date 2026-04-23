const express = require('express');
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
