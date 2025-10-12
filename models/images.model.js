const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImageSchema = new Schema({
  file_path: { type: String },
  url: { type: String, required: true },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('images', ImageSchema);