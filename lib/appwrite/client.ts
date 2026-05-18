import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { Account, Client, Databases } from 'react-native-appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './config';

const platform =
  Constants.expoConfig?.ios?.bundleIdentifier ??
  Constants.expoConfig?.android?.package ??
  'com.baladi.mybaladi';

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setPlatform(platform);

type ClientWithPing = Client & {
  ping: () => Promise<unknown>;
};

(client as ClientWithPing).ping = async function ping() {
  const endpoint = APPWRITE_ENDPOINT.replace(/\/$/, '');
  return client.call('GET', new URL(`${endpoint}/ping`));
};

let account: Account | null = null;
let databases: Databases | null = null;

export function getAppwriteClient(): ClientWithPing {
  return client as ClientWithPing;
}

export function getAccount(): Account {
  if (!account) {
    account = new Account(client);
  }
  return account;
}

export function getDatabases(): Databases {
  if (!databases) {
    databases = new Databases(client);
  }
  return databases;
}

export { isAppwriteConfigured, isAppwriteDatabaseConfigured } from './config';
