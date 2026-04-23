const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String },
  weight:    { type: Number, default: 0 },
  material:  { type: String, default: 'general' },
  points:    { type: Number },
  binId:     { type: String },
  timestamp: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Transaction', transactionSchema);
