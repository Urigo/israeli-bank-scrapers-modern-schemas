import puppeteer from 'puppeteer';

export async function terminatePage(page: puppeteer.Page) {
    await page.close();
  }