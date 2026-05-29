import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { createObjectCsvWriter } from 'csv-writer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dom-kuhni';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');

  const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
  console.log(`Exporting ${orders.length} orders...`);

  const outPath = `export-orders-${Date.now()}.csv`;
  const stream = fs.createWriteStream(outPath, 'utf-8');
  stream.write('\uFEFF'); // BOM for Excel

  const header = 'ID,Имя,Телефон,Email,Комментарий,Тип кухни,Бюджет,Источник,Статус,Комментарий менеджера,Дата\n';
  stream.write(header);

  for (const o of orders) {
    const row = `"${o.orderId}","${o.name}","${o.phone}","${o.email || ''}","${(o.comment || '').replace(/"/g, '""')}","${o.kitchenType || ''}","${o.budget || ''}","${o.source || ''}","${o.status}","${(o.managerComment || '').replace(/"/g, '""')}","${new Date(o.createdAt).toISOString()}"\n`;
    stream.write(row);
  }

  stream.end();
  console.log(`Saved to ${outPath}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
