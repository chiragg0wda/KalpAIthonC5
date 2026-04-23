const mongoose = require('mongoose');
const registrationSessionSchema = new mongoose.Schema({
  uid:       { type: String, default: null },
  createdAt: { type: Date, default: Date.now, expires: 120 }
});
module.exports = mongoose.model('RegistrationSession', registrationSessionSchema);
