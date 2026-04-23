const express = require('express');
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
