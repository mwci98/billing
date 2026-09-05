import {getAdminAuth, getAdminDb} from '../../../api/_firebase-admin.js';

export const firebaseAdmin = {getDb: getAdminDb, getAuth: getAdminAuth};
