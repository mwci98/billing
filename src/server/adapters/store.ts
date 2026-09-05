import {getAdminDb} from '../../../api/_firebase-admin.js';
type DbFactory = typeof getAdminDb;
let dbFactory: DbFactory = getAdminDb;
export const adminStoreAdapter = {getDb: () => dbFactory(), setDbForTests: (factory: DbFactory) => { dbFactory = factory; }, reset: () => { dbFactory = getAdminDb; }};
