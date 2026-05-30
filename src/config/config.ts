import dns from 'node:dns';
import dotenv from 'dotenv';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();
