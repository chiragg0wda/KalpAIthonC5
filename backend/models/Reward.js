const mongoose = require('mongoose');
const rewardSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  cost:        { type: Number, required: true },
  stock:       { type: Number, default: -1 }
});
module.exports = mongoose.model('Reward', rewardSchema);
