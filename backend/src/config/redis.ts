import Redis from 'ioredis';
import { createClient } from 'redis';
import winston from 'winston';

// 配置日志
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Redis 配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

// 用于 Pub/Sub 和持久化
export const redis = new Redis(redisConfig);

// 用于一般查询
export const redisClient = createClient({
  url: `redis://${redisConfig.host}:${redisConfig.port}`,
  password: redisConfig.password
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

// 房间数据操作封装
export const RoomStore = {
  async get(roomId: string): Promise<any | null> {
    const data = await redis.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
  },

  async set(roomId: string, room: any, ttl: number = 3600): Promise<void> {
    await redis.setex(`room:${roomId}`, ttl, JSON.stringify(room));
  },

  async delete(roomId: string): Promise<void> {
    await redis.del(`room:${roomId}`);
  },

  async exists(roomId: string): Promise<boolean> {
    const exists = await redis.exists(`room:${roomId}`);
    return exists === 1;
  },

  async update(roomId: string, updater: (room: any) => any): Promise<any> {
    const room = await this.get(roomId);
    if (!room) return null;
    
    const updated = updater(room);
    await this.set(roomId, updated);
    return updated;
  }
};

// 生成6位房间码
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // 排除易混淆字符
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 健康检查
export async function checkHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}