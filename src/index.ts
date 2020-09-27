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

const scrapersDict: {[k:string]: ((page: puppeteer.Browser) => Promise<number>)}  = {
  isracard: scraper.isracard,
  poalimBuisness: scraper.poalimBuisness,
  poalimPersonal: scraper.poalimPersonal
}

export async function main(companies?: string[]) {
  const browser = await puppeteer.launch({ headless: true });
  let promises: Promise<any>[] = [];

  if (companies) {
    companies.forEach((company) => {
      var index = Object.keys(scrapersDict).indexOf(company);
      promises.push(Object.values(scrapersDict)[index](browser))
    })
  } else return 0

  let results = await Promise.all(promises);
  browser.close();
  return results
}

main(["isracard"]);
