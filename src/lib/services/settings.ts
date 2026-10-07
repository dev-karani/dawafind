import { db } from "../db";

export async function getSettings() {
  return db.platformSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}
