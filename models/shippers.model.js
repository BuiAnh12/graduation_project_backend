const mongoose = require('mongoose');
const { Schema } = mongoose;

const ShipperSchema = new Schema({
  acountId: { type: Schema.Types.ObjectId, ref: 'accounts' },
  vehicleId: {type: Schema.Types.ObjectId, ref: 'vehicles'},
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phonenumber: { type: String },
  gender: { type: String },

  avatarImage: { type: Schema.Types.ObjectId, ref: 'images' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ShipperSchema.virtual('accounts', {
  ref: 'accounts',
  localField: 'acountId',
  foreignField: '_id',
  justOne: true
});

ShipperSchema.virtual('vehicles', {
  ref: 'vehicles', 
  localField: 'vehicleId',
  foreignField: '_id',
  justOne: true
})

module.exports = mongoose.model('shippers', ShipperSchema);
