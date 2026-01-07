export interface IStorage {}

export class MemStorage implements IStorage {
  constructor() {}
}

export async function initStorage(): Promise<IStorage> {
  return new MemStorage();
}

export let storage: IStorage = new MemStorage();
