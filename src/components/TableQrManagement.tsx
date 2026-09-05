// @ts-nocheck
import React, {useEffect, useMemo, useState} from 'react';
import QRCode from 'qrcode';
import {Download, Plus, RefreshCw, Table2, Trash2} from 'lucide-react';
import {collection, deleteDoc, doc, onSnapshot, setDoc} from 'firebase/firestore';
import {db} from '../lib/firebase';
import {useAppState} from '../lib/stateContext';
import {TableQrTable} from '../types';

const safe = (value: string) => value.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
const newToken = () => `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

export const TableQrManagement: React.FC = () => {
  const {currentUser, settings, activeStore, hasPermission, triggerToast} = useAppState();
  const [tables, setTables] = useState<TableQrTable[]>([]);
  const [tableName, setTableName] = useState('');
  const [busy, setBusy] = useState('');
  const ownerScope = settings.tenantId || currentUser?.tenantId || safe(currentUser?.email || 'workspace');
  const scope = activeStore.id === 'primary-store' || activeStore.id === ownerScope ? ownerScope : `${ownerScope}__store__${safe(activeStore.id)}`;
  const storeSlug = activeStore.configuration?.onlineStore?.slug || settings.onlineStore?.slug || '';
  const locationKey = activeStore.id === 'primary-store' || activeStore.id === ownerScope ? 'main' : safe(activeStore.branchCode || activeStore.id).replace(/_/g, '-');
  const locationName = activeStore.name || settings.storeName;
  const canManage = hasPermission('canManageTableQr');

  useEffect(() => onSnapshot(collection(db, 'users', scope, 'table_qr_tables'), snapshot => setTables(snapshot.docs.map(item => item.data() as TableQrTable).sort((a, b) => a.name.localeCompare(b.name)))), [scope]);

  const publicUrl = (table: TableQrTable) => `${window.location.origin}/r/${table.slug}/table/${table.token}`;
  const saveTable = async (table: TableQrTable) => {
    await setDoc(doc(db, 'users', scope, 'table_qr_tables', table.id), table);
    await setDoc(doc(db, 'public_tables', table.token), {token: table.token, ownerScope, workspaceScope: scope, slug: table.slug, locationKey: table.locationKey, tableName: table.name, active: true});
  };
  const addTable = async () => {
    if (!canManage || !storeSlug) return triggerToast('Enable the restaurant online menu first.', 'warning');
    const name = tableName.trim();
    if (!name) return triggerToast('Enter a table name or number.', 'warning');
    const now = new Date().toISOString();
    const table: TableQrTable = {id: `table-${safe(name)}-${Date.now()}`, name, token: newToken(), locationId: activeStore.id, locationKey, locationName, slug: storeSlug, active: true, createdAt: now, updatedAt: now};
    setBusy(table.id); setTableName('');
    try { await saveTable(table); triggerToast(`${name} QR created.`, 'success'); } catch { triggerToast('Could not create the table QR.', 'error'); } finally { setBusy(''); }
  };
  const regenerate = async (table: TableQrTable) => {
    setBusy(table.id);
    try { await deleteDoc(doc(db, 'public_tables', table.token)); await saveTable({...table, token: newToken(), updatedAt: new Date().toISOString()}); triggerToast(`${table.name} QR regenerated.`, 'success'); } catch { triggerToast('Could not regenerate the QR.', 'error'); } finally { setBusy(''); }
  };
  const printTable = async (table: TableQrTable) => {
    const qr = await QRCode.toDataURL(publicUrl(table), {width: 320, margin: 2, errorCorrectionLevel: 'M'});
    const popup = window.open('', '_blank', 'width=500,height=700');
    if (!popup) return triggerToast('Allow popups to print the table QR.', 'warning');
    popup.document.write(`<html><body style="font-family:Arial;text-align:center;padding:32px"><h1>${settings.storeName}</h1><h2>${table.name}</h2><img src="${qr}" style="width:320px;height:320px"/><p>Scan to view the menu and order</p><script>window.onload=()=>window.print()</script></body></html>`); popup.document.close();
  };

  if (!canManage) return <div className="rounded-md border border-red-200 bg-red-50 p-8 text-center text-sm font-bold text-red-700">Table QR management permission required.</div>;
  return <div className="mx-auto w-full max-w-4xl space-y-5 p-3 sm:p-6">
    <header className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141416] sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase text-emerald-600">{locationName}</p><h1 className="mt-1 text-2xl font-black">Table QR Management</h1><p className="mt-1 text-sm text-gray-500">Permanent QR codes for this restaurant outlet.</p></div><div className="flex items-center gap-2"><input value={tableName} onChange={event => setTableName(event.target.value)} onKeyDown={event => event.key === 'Enter' && void addTable()} placeholder="Table 5" className="h-11 rounded-md border border-gray-200 px-3 text-sm dark:border-white/10 dark:bg-white/5" /><button type="button" onClick={() => void addTable()} disabled={Boolean(busy)} className="flex h-11 items-center gap-2 rounded-md bg-emerald-500 px-4 text-xs font-black text-white"><Plus className="h-4 w-4" />Add table</button></div></header>
    {tables.length ? <div className="grid gap-4 sm:grid-cols-2">{tables.map(table => <TableCard key={table.id} table={table} url={publicUrl(table)} busy={busy === table.id} onPrint={() => void printTable(table)} onRegenerate={() => void regenerate(table)} />)}</div> : <div className="rounded-md border border-dashed border-gray-300 bg-white py-20 text-center dark:border-white/10 dark:bg-[#141416]"><Table2 className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-black">No table QR codes yet</p><p className="mt-1 text-sm text-gray-500">Add your first table above.</p></div>}
  </div>;
};

const TableCard = ({table, url, busy, onPrint, onRegenerate}: {table: TableQrTable; url: string; busy: boolean; onPrint: () => void; onRegenerate: () => void}) => <article className="rounded-md border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416]"><div className="flex items-center justify-between"><div><h2 className="font-black">{table.name}</h2><p className="mt-1 text-[10px] text-gray-400">{table.locationName}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">Active</span></div><div className="mt-4 flex justify-center rounded-md bg-gray-50 p-3 dark:bg-white/5"><QrPreview value={url} /></div><p className="mt-3 truncate font-mono text-[10px] text-gray-400">{url}</p><div className="mt-4 flex gap-2"><button type="button" onClick={onPrint} disabled={busy} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-gray-950 text-xs font-black text-white"><Download className="h-4 w-4" />Print QR</button><button type="button" onClick={onRegenerate} disabled={busy} className="flex h-10 items-center justify-center rounded-md border border-gray-200 px-3 text-gray-600 dark:border-white/10 dark:text-gray-300" aria-label="Regenerate QR"><RefreshCw className="h-4 w-4" /></button></div></article>;
const QrPreview = ({value}: {value: string}) => { const [src, setSrc] = useState(''); useEffect(() => {QRCode.toDataURL(value, {width: 180, margin: 1}).then(setSrc);}, [value]); return src ? <img src={src} alt="Table QR code" className="h-44 w-44" /> : <div className="h-44 w-44 animate-pulse bg-gray-200" />; };
