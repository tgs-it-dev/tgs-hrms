import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from 'src/entities/system-setting.entity';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(
    @InjectRepository(SystemSetting)
    private readonly repo: Repository<SystemSetting>,
  ) {}

  async onModuleInit() {
    await this.reloadCache();
  }

  async reloadCache() {
    const settings = await this.repo.find();
    this.cache.clear();
    for (const s of settings) {
      this.cache.set(s.key, s.value);
    }
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  getBoolean(key: string, defaultValue = true): boolean {
    const val = this.cache.get(key);
    if (val === undefined) return defaultValue;
    return val.toLowerCase() === 'true';
  }

  async set(key: string, value: string, description?: string): Promise<void> {
    await this.repo.upsert(
      { key, value, description: description ?? null },
      { conflictPaths: ['key'], skipUpdateIfNoValuesChanged: true },
    );
    this.cache.set(key, value);
  }

  async getAll(): Promise<SystemSetting[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }
}
