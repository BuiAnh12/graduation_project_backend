const mongoose = require('mongoose');
const { Schema } = mongoose;

const VehicleSchema = new Schema({
  vehicleNumber: { type: String, required: true },
  vehicleType: { type: String, required: true },
  vehicleColor: { type: String, required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('vehicles', VehicleSchema);