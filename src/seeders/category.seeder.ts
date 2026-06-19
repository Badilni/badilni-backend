import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import '../config/config.js';
import mongoose from 'mongoose';
import { Category } from '../models/category.model.js';

const categories = [
  { name: 'Technology' },
  { name: 'Design & Creative' },
  { name: 'Languages & Translation' },
  { name: 'Academic Tutoring' },
  { name: 'Music & Performing Arts' },
  { name: 'Fitness & Health' },
  { name: 'Business & Career' },
  { name: 'Home Improvement & Maintenance' },
  { name: 'Photography & Video' },
  { name: 'Cooking & Nutrition' },
  { name: 'Arts & Crafts' },
  { name: 'Automotive & Mechanical' },
  { name: 'Lifestyle & Hobbies' },
];

export const seedCategories = async () => {
  try {
    const dbUri = process.env.DB_URI!
      .replace('<db_username>', process.env.DB_USERNAME!)
      .replace('<db_password>', process.env.DB_PASSWORD!);
    
    console.log('Connecting to database...');
    await mongoose.connect(dbUri);
    console.log('Connected to DB. Starting seed...');

    await Category.deleteMany();
    await Category.create(categories);
    console.log(`Successfully seeded ${categories.length} categories`);
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
};

seedCategories();

