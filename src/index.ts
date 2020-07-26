import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import * as scraper from './scrapers/scrapersExport';

const { config } = dotenv;
config();

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      HAPOALIM_PERSONAL_USER_CODE: string;
      HAPOALIM_PERSONAL_PASSWORD: string;
      HAPOALIM_BUISNESS_USER_CODE: string;
      HAPOALIM_BUISNESS_PASSWORD: string;
      ISRACARD_ID: string;
      ISRACARD_PASSWORD: string;
      ISRACARD_6_DIGITS: string;
    }
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  let promises: Promise<any>[] = [];
  // Choose Companies to Scrape:
  const companies = [
    scraper.isracard,
    // scraper.poalimBuisness,
    scraper.poalimPersonal
  ]
  for (let company of companies) {
    const page = await browser.newPage();
    promises.push(company(page));
  }
  await Promise.all(promises);
  browser.close();
  return 0
}

main();
