const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  rfid_uid:   { type: String, required: true, unique: true, uppercase: true, trim: true },
  pin:        { type: String, default: '1234' },
  points:     { type: Number, default: 0 },
  totalWaste: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema);
