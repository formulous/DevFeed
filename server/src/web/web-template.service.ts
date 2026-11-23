import { Inject, Injectable, Logger } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { parseSeoRoutes, SeoRoutes } from './seo-routes';

export const TEMPLATE_CHECK_MS = 2000;

interface Loaded<T> {
  mtimeMs: number;
  value: T;
}

export interface WebAssets {
  template: string | null;
  routes: SeoRoutes | null;
}

@Injectable()
export class WebTemplateService {
  private readonly logger = new Logger(WebTemplateService.name);
  private template: Loaded<string> | null = null;
  private routes: Loaded<SeoRoutes> | null = null;
  private checkedAt = -Infinity;
  private pending: Promise<void> | null = null;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async assets(now = Date.now()): Promise<WebAssets> {
    if (now - this.checkedAt >= TEMPLATE_CHECK_MS) {
      this.checkedAt = now;
      this.pending ??= this.refresh().finally(() => (this.pending = null));
    }
    if (this.pending) await this.pending;
    return { template: this.template?.value ?? null, routes: this.routes?.value ?? null };
  }

  private async refresh(): Promise<void> {
    const dir = this.env.webDistDir;
    this.template = await this.reload(join(dir, 'index.html'), this.template, (raw) => raw);
    this.routes = await this.reload(join(dir, 'routes.json'), this.routes, parseSeoRoutes);
  }

  private async reload<T>(path: string, current: Loaded<T> | null, parse: (raw: string) => T): Promise<Loaded<T> | null> {
    try {
      const { mtimeMs } = await stat(path);
      if (current && current.mtimeMs === mtimeMs) return current;
      return { mtimeMs, value: parse(await readFile(path, 'utf8')) };
    } catch (error) {
      if (!current) this.logger.warn(`${path} 읽기 실패: ${(error as Error).message}`);
      return current;
    }
  }
}
