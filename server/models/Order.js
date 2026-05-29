import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default: () => uuid().slice(0, 8).toUpperCase(),
    unique: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  comment: { type: String, trim: true, default: '' },
  kitchenType: { type: String, default: '' },
  budget: { type: String, default: '' },
  source: { type: String, default: 'Сайт' },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'completed', 'cancelled'],
    default: 'new',
    index: true,
  },
  telegramMessageId: { type: Number },
  managerComment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

orderSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

orderSchema.methods.toPublic = function () {
  return {
    orderId: this.orderId,
    name: this.name,
    phone: this.phone,
    email: this.email,
    comment: this.comment,
    kitchenType: this.kitchenType,
    budget: this.budget,
    source: this.source,
    status: this.status,
    managerComment: this.managerComment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Order = mongoose.model('Order', orderSchema);
export default Order;
