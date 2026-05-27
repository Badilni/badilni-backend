import crypto from 'crypto';
import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },
  bio: {
    type: String,
  },
  skillTags: [String],
  walletBalance: {
    type: Number,
    min: [0, 'Wallet balance can not be negative'],
  },
  creditsInEscrow: {
    type: Number,
    min: [0, 'Escrow can not be negative'],
  },
  totalSessionsCompleted: {
    type: Number,
    min: [0, 'Sessions number must be positive number'],
    default: 0,
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    set: (val) => Math.round(val * 10) / 10,
  },
  passwordChangedAt: {
    type: Date,
    select: false,
  },
  passwordResetCode: {
    type: String,
    select: false,
  },
  passwordResetCodeExpires: {
    type: Date,
    select: false,
  },
  verificationCode: {
    type: String,
    select: false,
  },
  verificationCodeExpires: {
    type: Date,
    select: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);

  this.passwordConfirm = undefined;

  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
});

userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    return changedTimestamp > JWTTimestamp;
  }

  return false;
};

userSchema.methods.generateCode = function (codeType) {
  const allowed = ['passwordResetCode', 'verificationCode'];
  if (!allowed.includes(codeType))
    throw new Error(`Invalid code type: ${codeType}`);

  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  this[codeType] = crypto.createHash('sha256').update(code).digest('hex');

  const minutes = codeType === 'passwordResetCode' ? 10 : 120;
  this[`${codeType}Expires`] = Date.now() + minutes * 60 * 1000;

  return code;
};

userSchema.pre(/^find/, function () {
  this.find({ active: { $ne: false } });
});

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetCode;
    delete ret.passwordResetCodeExpires;
    delete ret.verificationCode;
    delete ret.verificationCodeExpires;
    delete ret.__v;
    return ret;
  },
});

userSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetCode;
    delete ret.passwordResetCodeExpires;
    delete ret.verificationCode;
    delete ret.verificationCodeExpires;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export { User };
