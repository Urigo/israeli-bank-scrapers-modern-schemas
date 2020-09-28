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

async function fetchMonth(page: puppeteer.Page, monthMoment: moment.Moment) {
  // get accounts data
  const billingDate = monthMoment.format('YYYY-MM-DD');
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const dashboardMonthData = await fetchGetWithinPage<IsracardDashboardMonth>(
    page,
    accountsUrl
  );

  let validation = await validateSchema(isracardDashboardMonth, dashboardMonthData);
  Object.assign(dashboardMonthData, validation)

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

    validation = await validateSchema(isracardCardsTransactionsList, transResult);
    Object.assign(transResult, validation)

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

export async function isracard(
  page: puppeteer.Page,
  options?: isracardOptions
) {
  const BASE_URL = 'https://digital.isracard.co.il';
  await page.goto(`${BASE_URL}/personalarea/Login`);

    await login(page);

  return {
    getTransactions: async () => {
      /* dates logic  */
      let startMoment = moment().subtract(1, 'years').startOf('month');
      const allMonths = [];
      let lastMonth = moment().startOf('month').add(1, 'month');

      while (startMoment.isSameOrBefore(lastMonth)) {
        allMonths.push(startMoment);
        startMoment = moment(startMoment).add(1, 'month');
      }

      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthMoment) => {
          return fetchMonth(page, monthMoment);
        })
      );
    },
  };
}

export class isracardOptions {
  validateSchema: boolean = false;
}
