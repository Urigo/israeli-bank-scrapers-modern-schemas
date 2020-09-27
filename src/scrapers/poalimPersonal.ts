import puppeteer from 'puppeteer';
import moment from 'moment';
import { fetchPoalimXSRFWithinPage, fetchGetWithinPage } from '../utils/fetch';
import hapoalimAccountDataSchemaFile from '../schemas/hapoalimAccountDataSchema.json';
import hapoalimILSCheckingTransactionsDataSchema from '../schemas/hapoalimILSCheckingTransactionsDataSchema.json';
import hapoalimForeignTransactionsSchema from '../schemas/hapoalimForeignTransactionsSchema.json';
import { HapoalimAccountDataSchema } from '../../generatedTypes/hapoalimAccountDataSchema';
import { HapoalimILSCheckingTransactionsDataSchema } from '../../generatedTypes/hapoalimILSCheckingTransactionsDataSchema';
import { HapoalimForeignTransactionsSchema } from '../../generatedTypes/hapoalimForeignTransactionsSchema';
import { validateSchema } from '../utils/validateSchema';
import { terminatePage } from '../utils/terminatePage';
import lodash from 'lodash';

declare namespace window {
  const bnhpApp: any;
}

const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;

const BASE_URL = 'https://login.bankhapoalim.co.il/ng-portals/auth/he/';

async function login(page: puppeteer.Page) {
  const userCode: string = process.env.HAPOALIM_PERSONAL_USER_CODE;
  const password: string = process.env.HAPOALIM_PERSONAL_PASSWORD;

  await page.waitFor('.login-btn');

  await page.type('#userCode', userCode);
  await page.type('#password', password);

  page.click('.login-btn');

  await page.waitForNavigation();
}

async function getInnerDetails(iLSTransactionsData: HapoalimILSCheckingTransactionsDataSchema, page: puppeteer.Page) {
  let promises: Promise<any>[] = [];
  let paths: (string|number)[][] = [];
  for (let i=0; i<iLSTransactionsData.transactions.length; i++) {
    const path = ["transactions", i, "details"]
    let value = lodash.get(iLSTransactionsData, path)
    if (value != null && value.charAt(0) == "/") {
      const detailsUrl = `https://login.bankhapoalim.co.il${value}`;
      let detailsData = fetchPoalimXSRFWithinPage<
        HapoalimForeignTransactionsSchema
      >(page, detailsUrl, '/current-account/transactions');

      promises.push(detailsData);
      paths.push(path);
    }
  }
  let results = await Promise.all(promises);

  for (let i=0; i<=results.length; i++) {
    lodash.set(iLSTransactionsData, paths[i], results[i]);
  }

  return iLSTransactionsData;
}

async function getData(page: puppeteer.Page) {
  const result = await page.evaluate(() => {
    return window.bnhpApp.restContext;
  });
  const apiSiteUrl = `https://login.bankhapoalim.co.il/${result.slice(1)}`;
  const accountDataUrl = `${apiSiteUrl}/general/accounts`;

  const accountDataResult = await fetchGetWithinPage<HapoalimAccountDataSchema>(
    page,
    accountDataUrl
  );

  validateSchema(
    'HapoalimAccountDataSchema',
    hapoalimAccountDataSchemaFile,
    accountDataResult
  );

  const API_DATE_FORMAT = 'YYYYMMDD';
  const defaultStartMoment = moment().subtract(1, 'years').add(1, 'day');
  const startDateString = defaultStartMoment.format(API_DATE_FORMAT);
  const endDateString = moment().format(API_DATE_FORMAT);

  if (accountDataResult) {
    let promises: Promise<any>[] = [];
    let dataRequests = accountDataResult.flatMap((account: any) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;

      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;
      let ILSTransactionsRequest = fetchPoalimXSRFWithinPage<
        HapoalimILSCheckingTransactionsDataSchema
      >(page, ILSCheckingTransactionsUrl, '/current-account/transactions');

      const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,100&detailedAccountTypeCodeList=142&lang=he`;
      let foreignTransactionsRequest = fetchGetWithinPage<
        HapoalimForeignTransactionsSchema
      >(page, foreignTransactionsUrl);

      promises.push(ILSTransactionsRequest,
        foreignTransactionsRequest
        );
    });

    let results = await Promise.all(promises);

    validateSchema(
      'HapoalimILSCheckingTransactionsDataSchema',
      hapoalimILSCheckingTransactionsDataSchema,
      results[0]
    );
    
    validateSchema(
      'HapoalimForeignTransactionsSchema',
      hapoalimForeignTransactionsSchema,
      results[1]
    );

    if (results[0]) {
      results[0] = await getInnerDetails(results[0]!, page);
    }
    
    console.log(results);
  }
}

export async function poalimPersonal(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });

  await page.goto(BASE_URL);
  await login(page);
  await getData(page);
  terminatePage(page);
  return 0;
}
