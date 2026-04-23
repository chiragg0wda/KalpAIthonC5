const mongoose = require('mongoose');
const binSchema = new mongoose.Schema({
  _id:           { type: String },
  name:          { type: String, required: true },
  currentWeight: { type: Number, default: 0 },
  maxCapacity:   { type: Number, default: 5000 },
  isFull:        { type: Boolean, default: false }
});
module.exports = mongoose.model('Bin', binSchema);
