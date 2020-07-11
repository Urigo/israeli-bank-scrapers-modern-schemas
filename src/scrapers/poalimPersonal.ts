import puppeteer from 'puppeteer';
import inquirer from 'inquirer';
import Ajv from 'ajv';
import moment from 'moment';
import { fetchPoalimXSRFWithinPage, fetchGetWithinPage } from '../utils/fetch';
import accountDataSchemaFile from '../schemas/accountDataSchema.json';
import ILSCheckingTransactionsDataSchemaFile from '../schemas/ILSCheckingTransactionsDataSchema.json';
import foreignTransactionsSchema from '../schemas/foreignTransactionsSchema.json';
import { AccountDataSchema } from '../../generatedTypes/accountDataSchema';
import { ILSCheckingTransactionsDataSchema } from '../../generatedTypes/ILSCheckingTransactionsDataSchema';
import { ForeignTransactionsSchema } from '../../generatedTypes/foreignTransactionsSchema';

declare namespace window {
  const bnhpApp: any;
}

const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;

const BASE_URL = 'https://login.bankhapoalim.co.il/ng-portals/auth/he/';

async function login(userCode: string, password: string, page: puppeteer.Page) {
  await page.waitFor('.login-btn');

  await page.type('#userCode', userCode);
  await page.type('#password', password);

  page.click('.login-btn');

  await Promise.all([page.waitForNavigation()]);
}

async function getData(page: puppeteer.Page) {
  const result = await page.evaluate(() => {
    return window.bnhpApp.restContext;
  });
  const apiSiteUrl = `https://login.bankhapoalim.co.il/${result.slice(1)}`;
  const accountDataUrl = `${apiSiteUrl}/general/accounts`;

  const accountDataResult = await fetchGetWithinPage<AccountDataSchema>(
    page,
    accountDataUrl
  );

  const ajv = new Ajv({ verbose: true });
  // TODO: Validate asyncrhniously
  const valid = ajv.validate(accountDataSchemaFile, accountDataResult);
  console.log(valid);
  console.log(ajv.errors);

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
          ILSCheckingTransactionsDataSchema
        >(page, ILSCheckingTransactionsUrl, '/current-account/transactions');

        // TODO: Get the list of foreign account and iterate over them
        // TODO: Type and validate all fetches
        // TODO: Check the DB to validate more strict on enums
        const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,100&detailedAccountTypeCodeList=142&lang=he`;
        let foreignTransactionsRequest = fetchGetWithinPage<
          ForeignTransactionsSchema
        >(page, foreignTransactionsUrl);

        promises.push(ILSTransactionsRequest, foreignTransactionsRequest);

        // // TODO: Share json-schema parts between schemas
        // const dollarsBalanceUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&view=graph&detailedAccountTypeCode=142&currencyCode=19&lang=he`;
        // allAccountRequests.push(fetchGetWithinPage(page, dollarsBalanceUrl));

        // const eurosBalanceUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&view=graph&detailedAccountTypeCode=142&currencyCode=100&lang=he`;
        // allAccountRequests.push(fetchGetWithinPage(page, eurosBalanceUrl));

        // const transactionBalanceUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&lang=he`;
        // allAccountRequests.push(fetchGetWithinPage(page, transactionBalanceUrl));

        // // TODO: Get card numbers
        // const creditCardTransactionsUrl = `${apiSiteUrl}/cards/transactions?accountId=${fullAccountNumber}&cardSuffix=2733&cardIssuingSPCode=1&transactionsType=current&totalInd=1`;
        // allAccountRequests.push(
        //   fetchGetWithinPage(page, creditCardTransactionsUrl)
        // );
      });

    // TODO: Flatten all Promises (not sure why they are not flatten by flatMap)
    // TODO: Validate all responses
    let results = await Promise.all(promises);

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
  await login(process.env.USER_CODE, process.env.PASSWORD, page);
  await getData(page);
}
