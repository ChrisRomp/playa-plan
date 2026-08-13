import { PdfmakeRendererService } from './pdfmake-renderer.service';

describe('PdfmakeRendererService', () => {
  it('shouldRenderAValidPdfBuffer', async () => {
    const service = new PdfmakeRendererService();

    const actualBuffer = await service.render({
      content: [{ text: 'Reusable PlayaPlan PDF renderer' }],
      defaultStyle: { font: 'Roboto' },
      info: { title: 'Renderer test' },
    });

    expect(actualBuffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(actualBuffer.length).toBeGreaterThan(500);
  });
});
