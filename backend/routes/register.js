const express = require('express');
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
