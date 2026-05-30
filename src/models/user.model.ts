import crypto from 'crypto';
import mongoose, { InferSchemaType, Query } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
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
      set: (val: number) => Math.round(val * 10) / 10,
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
  },
  {
    methods: {
      async correctPassword(candidatePassword: string) {
        return await bcrypt.compare(candidatePassword, this.password);
      },

      changedPasswordAfter(JWTTimestamp: number) {
        if (this.passwordChangedAt) {
          const changedTimestamp = Math.floor(
            this.passwordChangedAt.getTime() / 1000,
          );

          return changedTimestamp > JWTTimestamp;
        }

        return false;
      },

      generateCode(codeType: 'passwordResetCode' | 'verificationCode') {
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        this[codeType] = crypto.createHash('sha256').update(code).digest('hex');

        const minutes = codeType === 'passwordResetCode' ? 10 : 120;
        this[`${codeType}Expires`] = new Date(Date.now() + minutes * 60 * 1000);

        return code;
      },
    },
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

userSchema.pre(/^find/, function () {
  (this as Query<any, any>).find({ active: { $ne: false } });
});

userSchema.set('toJSON', {
  transform: (doc, ret: Record<string, any>) => {
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
  transform: (doc, ret: Record<string, any>) => {
    delete ret.password;
    delete ret.passwordResetCode;
    delete ret.passwordResetCodeExpires;
    delete ret.verificationCode;
    delete ret.verificationCodeExpires;
    delete ret.__v;
    return ret;
  },
});

export type IUser = InferSchemaType<typeof userSchema>;

export const User = mongoose.model('User', userSchema);

export type UserDocument = InstanceType<typeof User>;
