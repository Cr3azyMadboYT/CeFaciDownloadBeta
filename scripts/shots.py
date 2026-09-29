import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file:///home/claude/cefaci-app/dist/index.html')
        await pg.wait_for_timeout(800)
        await pg.screenshot(path='shots/1-onb.png')
        await pg.click('text=Sector 2'); await pg.click('text=Mai departe')
        for t in ['Chill', 'Fun', 'Pizza', 'Party']: await pg.click(f'button:has-text("{t}")')
        await pg.click('text=Hai să vedem'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/2-home.png', full_page=True)
        await pg.click('text=Arată-mi 3 variante'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/3-results.png', full_page=True)
        await pg.click('.card.big .cardhit'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/4-venue.png', full_page=True)
        await pg.click('button.tab:has-text("Caută")'); await pg.fill('#q', 'pizza sector 2'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shots/5-search.png')
        await pg.emulate_media(color_scheme='dark'); await pg.fill('#q', 'caru cu bere'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='shots/6-dark.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
