import { databaseService } from '../services/databaseService';

export async function testConnection(): Promise<boolean> {
  return databaseService.testConnection();
}

void testConnection();

