import * as puppeteer from 'puppeteer';
import * as inquirer from 'inquirer';
import * as Ajv from 'ajv';
import * as moment from 'moment';
import { fetchPoalimXSRFWithinPage, fetchGetWithinPage } from '../utils/fetch';
import accountDataSchemaFile from '../schemas/accountDataSchema.json';
import ILSCheckingTransactionsDataSchemaFile from '../schemas/ILSCheckingTransactionsDataSchema.json';
import foreignTransactionsSchema from '../schemas/foreignTransactionsSchema.json';
import { AccountDataSchema } from '../../generatedTypes/accountDataSchema';
import { ILSCheckingTransactionsDataSchema } from '../../generatedTypes/ILSCheckingTransactionsDataSchema';
import { ForeignTransactionsSchema } from '../../generatedTypes/foreignTransactionsSchema';
import { IncomingHttpHeaders } from 'http';
import { v4 as uuidv4 } from 'uuid';
import * as fetch from 'node-fetch';

declare namespace window {
  const bnhpApp: any;
}

async function login(userCode: string, password: string, page: puppeteer.Page) {
  await page.waitFor('#inputSend');

  await page.type('#userID', userCode);
  await page.type('#userPassword', password);

  page.click('#inputSend');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'SMSPassword',
      message: 'Enter the code you got in SMS:',
    },
  ]);

  await page.type('#codeForOtp', answers.SMSPassword);

  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
    page.click('#buttonNo'),
  ]);
}

export async function hapoalim(page: puppeteer.Page) {
  const BASE_URL = 'https://biz2.bankhapoalim.co.il/authenticate/logon/main';

  await page.goto(BASE_URL);
  await login(process.env.USER_CODE, process.env.PASSWORD, page);

  const result = await page.evaluate(() => {
    return window.bnhpApp.restContext;
  });
  const apiSiteUrl = `https://biz2.bankhapoalim.co.il/${result.slice(1)}`;

  const API_DATE_FORMAT = 'YYYYMMDD';
  const defaultStartMoment = moment().subtract(1, 'years').add(1, 'day');
  const startDateString = defaultStartMoment.format(API_DATE_FORMAT);
  const endDateString = moment().format(API_DATE_FORMAT);
  // TODO: https://www.npmjs.com/package/node-fetch-cookies

  // TODO: Bring back validation as an option flag to each function
  // const ajv = new Ajv({ verbose: true });
  // // TODO: Validate asyncrhniously
  // const valid = ajv.validate(accountDataSchemaFile, accountDataResult);
  // console.log(valid);
  // console.log(ajv.errors);

  return {
    getAccountsData: () => {
      const accountDataUrl = `${apiSiteUrl}/general/accounts`;
      return fetchGetWithinPage<AccountDataSchema>(page, accountDataUrl);
    },
    getILSTransactions: (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;

      return fetchPoalimXSRFWithinPage<ILSCheckingTransactionsDataSchema>(
        page,
        ILSCheckingTransactionsUrl,
        '/current-account/transactions'
      );
    },
    getForeignTransactions: (account: {
      bankNumber: string;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,100&detailedAccountTypeCodeList=142&lang=he`;
      return fetchGetWithinPage<ForeignTransactionsSchema>(
        page,
        foreignTransactionsUrl
      );
    },
  };
}
