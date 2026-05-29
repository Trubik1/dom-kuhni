import mongoose from 'mongoose';
import crypto from 'crypto';

const pageViewSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  page: { type: String, required: true },
  referrer: { type: String, default: '' },
  utm_source: { type: String, default: '' },
  utm_medium: { type: String, default: '' },
  device: { type: String, enum: ['desktop', 'mobile'], default: 'desktop' },
  ipHash: { type: String },
  duration: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ page: 1, createdAt: -1 });

pageViewSchema.statics.hashIp = function (ip) {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(ip + process.env.IP_SALT || 'dom-kuhni-salt')
    .digest('hex')
    .slice(0, 16);
};

pageViewSchema.statics.getActiveNow = function () {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.distinct('sessionId', { updatedAt: { $gte: fiveMinAgo } });
};

const PageView = mongoose.model('PageView', pageViewSchema);
export default PageView;
