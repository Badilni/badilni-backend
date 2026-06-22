import crypto from 'crypto';
// import mongoose, { InferSchemaType, Query } from 'mongoose';
import mongoose, { InferSchemaType } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import { CodeType } from '../modules/auth/auth.types.js';
import { Transaction } from './transaction.model.js';

const WELCOME_BONUS_CREDITS = 3;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: [2, 'name must be at least two characters'],
      required: [true, 'Please provide a name'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    avatar: {
      url: {
        type: String,
        validate: validator.isURL,
        default:
          'https://res.cloudinary.com/dcujx986a/image/upload/v1780758978/default_avatar_yvgiqh.jpg',
      },
      publicId: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    bio: {
      type: String,
      minLength: [4, 'Bio is too short'],
    },
    skillTags: [String],
    walletBalance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance can not be negative'],
    },
    creditsInEscrow: {
      type: Number,
      default: 0,
      min: [0, 'Escrow can not be negative'],
    },
    totalSessionsCompleted: {
      type: Number,
      min: [0, 'Sessions number must be positive number'],
      default: 0,
    },
    averageRating: {
      type: Number,
      min: [0, 'Average rating must be between 0 and 5'],
      max: [5, 'Average rating must be between 0 and 5'],
      default: 0,
      set: (val: number) => Math.round(val * 10) / 10,
    },
    reviewSummary: {
      type: String,
      maxlength: [500, 'Review summary cannot exceed 500 characters'],
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
    pendingEmail: {
      type: String,
    },
    pendingEmailCode: {
      type: String,
      select: false,
    },
    pendingEmailCodeExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
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

      generateCode(codeType: CodeType) {
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        this[codeType] = crypto.createHash('sha256').update(code).digest('hex');

        const minutes =
          codeType === 'passwordResetCode' || codeType === 'pendingEmailCode'
            ? 15
            : 120;

        this[`${codeType}Expires`] = new Date(Date.now() + minutes * 60 * 1000);

        return code;
      },
    },
  },
);

userSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400, partialFilterExpression: { isVerified: false } },
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

// Welcome credits: new users get a starter wallet so they can make their
// first booking without having offered anything yet (see Badilni plan §1.4/§6.4).
userSchema.post('save', async function (doc) {
  if (!this.$locals.wasNew) {
    return;
  }

  doc.walletBalance = WELCOME_BONUS_CREDITS;
  await doc.updateOne({ $set: { walletBalance: WELCOME_BONUS_CREDITS } });

  await Transaction.create({
    fromUserId: null,
    toUserId: doc._id,
    amount: WELCOME_BONUS_CREDITS,
    type: 'welcome_bonus',
    description: 'Welcome bonus for joining Badilni',
  });
});

userSchema.pre('save', function () {
  this.$locals.wasNew = this.isNew;
});

// userSchema.pre(/^find/, function () {
//   (this as Query<any, any>).find({ active: { $ne: false } });
// });

const sanitizeUserOutput = (ret: Record<string, any>) => {
  delete ret.password;
  delete ret.passwordChangedAt;
  delete ret.passwordResetCode;
  delete ret.passwordResetCodeExpires;
  delete ret.verificationCode;
  delete ret.verificationCodeExpires;
  delete ret.active;
  delete ret.pendingEmailCode;
  delete ret.pendingEmailCodeExpires;
  delete ret.__v;
  return ret;
};

userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => sanitizeUserOutput(ret),
});

userSchema.set('toObject', {
  virtuals: true,
});

export type IUser = InferSchemaType<typeof userSchema>;

export const User = mongoose.model('User', userSchema);

export type UserDocument = InstanceType<typeof User>;