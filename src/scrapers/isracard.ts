import puppeteer from 'puppeteer';
import * as moment from 'moment';
import * as lodash from 'lodash';
import { fetchGetWithinPage, fetchPostWithinPage } from '../utils/fetch';
import { IsracardDashboardMonth } from '../../generatedTypes/isracardDashboardMonth';
import { IsracardCardsTransactionsList } from '../../generatedTypes/isracardCardsTransactionsList';
import * as isracardDashboardMonth from '../schemas/isracardDashboardMonth.json';
import * as isracardCardsTransactionsList from '../schemas/ILSCheckingTransactionsDataSchema.json';
import { validateSchema } from '../utils/validateSchema';

const SERVICE_URL =
  'https://digital.isracard.co.il/services/ProxyRequestHandler.ashx';

async function login(page: puppeteer.Page) {
  const validateUrl = `${SERVICE_URL}?reqName=performLogonI`;
  const validateRequest = {
    MisparZihuy: process.env.ISRACARD_ID,
    Sisma: process.env.ISRACARD_PASSWORD,
    cardSuffix: process.env.ISRACARD_6_DIGITS,
    countryCode: '212',
    idType: '1',
  };
  return fetchPostWithinPage(page, validateUrl, validateRequest);
}

async function fetchAndEditMonth(
  page: puppeteer.Page,
  monthMoment: moment.Moment,
  options?: isracardOptions
) {
  // get accounts data
  const billingDate = monthMoment.format('YYYY-MM-DD');
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const dashboardMonthData = await fetchGetWithinPage<IsracardDashboardMonth>(
    page,
    accountsUrl
  );

  if (options && options.validateSchema) {
    let validation = await validateSchema(
      isracardDashboardMonth,
      dashboardMonthData
    );
    Object.assign(dashboardMonthData, validation);
  }

  /* create conainer object by user accounts */
  if (dashboardMonthData) {
    const accounts = dashboardMonthData.DashboardMonthBean.cardsCharges.map(
      (cardCharge: {
        cardIndex: string;
        cardNumber: any;
        billingDate: moment.MomentInput;
      }) => {
        return {
          index: parseInt(cardCharge.cardIndex, 10),
          accountNumber: cardCharge.cardNumber,
          processedDate: moment(
            cardCharge.billingDate,
            'DD/MM/YYYY'
          ).toISOString(),
        };
      }
    );

    /* get transactions data */
    const month = monthMoment.month() + 1;
    const monthStr = month < 10 ? `0${month}` : month.toString();
    const transUrl = `${SERVICE_URL}?reqName=CardsTransactionsList&month=${monthStr}&year=${monthMoment.year()}&requiredDate=N`;
    const transResult = await fetchGetWithinPage<IsracardCardsTransactionsList>(
      page,
      transUrl
    );

    if (options && options.validateSchema) {
      let validation = await validateSchema(
        isracardCardsTransactionsList,
        transResult
      );
      Object.assign(transResult, validation);
    }

    const accountTxns: { [key: string]: any } = {};
    accounts.forEach((account) => {
      const txnGroups = lodash.get(
        transResult,
        `CardsTransactionsListBean.Index${account.index}.CurrentCardTransactions`
      );

      if (txnGroups) {
        let txnIsrael: any[] = [];
        let txnAbroad: any[] = [];
        txnGroups.forEach((txnGroup: { txnIsrael: any; txnAbroad: any }) => {
          if (txnGroup.txnIsrael) {
            const txns = txnGroup.txnIsrael.map((txn: any) => {
              return Object.assign(txn, {
                processedDate: account.processedDate,
              });
            });
            txnIsrael.push(...txns);
          }

          if (txnGroup.txnAbroad) {
            const txns = txnGroup.txnAbroad.map((txn: any) => {
              return Object.assign(txn, {
                processedDate: account.processedDate,
              });
            });
            txnAbroad.push(...txns);
          }
        });
        const accountNum = lodash.get(account, 'accountNumber');
        accountTxns[accountNum] = {
          accountNumber: accountNum,
          index: account.index,
          txnIsrael: txnIsrael,
          txnAbroad: txnAbroad,
        };
      }
    });
    return accountTxns;
  }
  return 0;
}

async function getMonthDashboard(
  page: puppeteer.Page,
  monthMoment: moment.Moment,
  options?: isracardOptions
) {
  // get accounts data
  const billingDate = monthMoment.format('YYYY-MM-DD');
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const data = fetchGetWithinPage<IsracardDashboardMonth>(page, accountsUrl);

  if (options && options.validateSchema) {
    await data;
    let validation = await validateSchema(isracardDashboardMonth, data);
    Object.assign(data, validation);
  } else {
    return data;
  }
}

async function getMonthTransactions(
  page: puppeteer.Page,
  monthMoment: moment.Moment,
  options?: isracardOptions
) {
  /* get transactions data */
  const month = monthMoment.month() + 1;
  const monthStr = month < 10 ? `0${month}` : month.toString();
  const transUrl = `${SERVICE_URL}?reqName=CardsTransactionsList&month=${monthStr}&year=${monthMoment.year()}&requiredDate=N`;
  const data = fetchGetWithinPage<IsracardCardsTransactionsList>(
    page,
    transUrl
  );

  if (options && options.validateSchema) {
    await data;
    let validation = await validateSchema(isracardCardsTransactionsList, data);
    Object.assign(data, validation);
    return data;
  } else {
    return data;
  }
}

export async function isracard(
  page: puppeteer.Page,
  options?: isracardOptions
) {
  const BASE_URL = 'https://digital.isracard.co.il';
  await page.goto(`${BASE_URL}/personalarea/Login`);

  await login(page);

  /* dates logic  */
  let startMoment = moment().subtract(5, 'years').startOf('month');
  const allMonths: moment.Moment[] = [];
  let lastMonth = moment().startOf('month').add(1, 'month');
  while (startMoment.isSameOrBefore(lastMonth)) {
    allMonths.push(startMoment);
    startMoment = moment(startMoment).add(1, 'month');
  }

  return {
    getDashboard: async () => {
      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthMoment) => {
          return getMonthDashboard(page, monthMoment, options);
        })
      );
    },
    getTransactions: async () => {
      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthMoment) => {
          return getMonthTransactions(page, monthMoment, options);
        })
      );
    },
    getEditedTransactions: async () => {
      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthMoment) => {
          return fetchAndEditMonth(page, monthMoment, options);
        })
      );
    }
  };
}

export class isracardOptions {
  validateSchema: boolean = false;
}
