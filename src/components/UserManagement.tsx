import React, {useState} from 'react';
import {KeyRound, ShieldCheck, Trash2, UserPlus, Users} from 'lucide-react';
import {useAppState} from '../lib/stateContext';
import {StaffPermissions} from '../types';

const DEFAULT_PERMISSIONS: StaffPermissions = {
  canBill: true,
  canPurchase: true,
  canManageProducts: false,
  canManageCustomers: true,
  canViewDashboard: false,
  canViewFinancials: false
};

const permissionLabels: Array<{key: keyof StaffPermissions; label: string; description: string}> = [
  {key: 'canBill', label: 'POS billing', description: 'Create invoices and accept payments'},
  {key: 'canPurchase', label: 'Purchases & stock', description: 'Record purchases and adjust inventory'},
  {key: 'canManageProducts', label: 'Product catalog', description: 'Add and edit SKU products'},
  {key: 'canManageCustomers', label: 'Customers & suppliers', description: 'Manage customer and supplier records'},
  {key: 'canViewDashboard', label: 'Dashboard', description: 'Open the operational dashboard'},
  {key: 'canViewFinancials', label: 'Financial totals', description: 'See revenue, sales totals, profit, and reports'}
];

export const UserManagement: React.FC = () => {
  const {staff, addStaff, updateStaff, deleteStaff} = useAppState();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passcode.length < 4) return;
    setSaving(true);
    try {
      const created = await addStaff(
        {name: name.trim(), email: email.trim(), permissions, active: true},
        passcode
      );
      if (created) {
        setName('');
        setEmail('');
        setPasscode('');
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Staff Access Management</h2>
            <p className="text-xs text-gray-400">Create staff logins and control exactly what each person can access.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleCreate} className="lg:col-span-5 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-900 pb-4">
            <UserPlus className="h-5 w-5 text-emerald-500" />
            <h3 className="font-bold text-gray-900 dark:text-white">Add staff member</h3>
          </div>

          <div className="space-y-3">
            <input required value={name} onChange={event => setName(event.target.value)} placeholder="Staff full name"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 text-sm" />
            <input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Staff email"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 text-sm" />
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input required minLength={4} type="password" value={passcode} onChange={event => setPasscode(event.target.value)}
                placeholder="Temporary passcode (minimum 4 characters)"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-3 pl-10 pr-3 text-sm" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Permissions</p>
            {permissionLabels.map(item => (
              <label key={item.key} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3 cursor-pointer">
                <span>
                  <span className="block text-xs font-bold text-gray-800 dark:text-gray-200">{item.label}</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">{item.description}</span>
                </span>
                <input type="checkbox" checked={permissions[item.key]}
                  onChange={event => setPermissions(current => ({...current, [item.key]: event.target.checked}))}
                  className="mt-1 h-4 w-4 accent-emerald-500" />
              </label>
            ))}
          </div>

          <button disabled={saving} className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Creating staff account…' : 'Create staff access'}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4">
          {staff.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-12 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="mt-3 text-sm font-bold text-gray-800 dark:text-gray-200">No staff accounts yet</p>
              <p className="mt-1 text-xs text-gray-400">Create the first controlled staff login using the form.</p>
            </div>
          ) : staff.map(member => (
            <div key={member.id} className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">{member.name}</h3>
                  <p className="text-xs text-gray-400 truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateStaff(member.id, {active: !member.active})}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold ${member.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'}`}>
                    {member.active ? 'ACTIVE' : 'DISABLED'}
                  </button>
                  <button type="button" onClick={() => deleteStaff(member.id)}
                    className="rounded-xl p-2 text-rose-500 hover:bg-rose-500/10" aria-label={`Delete ${member.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {permissionLabels.map(item => (
                  <label key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-xs cursor-pointer">
                    <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                    <input type="checkbox" checked={member.permissions[item.key]}
                      onChange={event => updateStaff(member.id, {
                        permissions: {...member.permissions, [item.key]: event.target.checked}
                      })}
                      className="h-4 w-4 accent-emerald-500" />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
