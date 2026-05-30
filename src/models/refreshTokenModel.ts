import crypto from 'crypto';
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default:
      Date.now() +
      parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN, 10) * 24 * 60 * 60 * 1000,
  },
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.pre('save', function () {
  this.token = crypto.createHash('sha256').update(this.token).digest('hex');
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export { RefreshToken };
