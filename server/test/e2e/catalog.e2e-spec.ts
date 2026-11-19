import { Test } from '@nestjs/testing';
import { CatalogController } from '../../src/catalog/catalog.controller';
import { CatalogService } from '../../src/catalog/catalog.service';

describe('GET /api/sources (Nest 앱 e2e 스모크)', () => {
  it('컨트롤러가 서비스 결과를 그대로 응답함', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: { sources: async () => ({ items: [{ id: 1 }] }) } }],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);
    const { port } = app.getHttpServer().address();
    const res = await fetch(`http://127.0.0.1:${port}/api/sources`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: 1 }] });
    await app.close();
  });
});
