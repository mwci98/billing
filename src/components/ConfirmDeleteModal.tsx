/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  itemName,
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-[10px] text-gray-400 font-mono">Permanent Removal Action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
          {itemName && (
            <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-500/10 rounded-2xl">
              <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">
                {itemName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-red-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Item</span>
          </button>
        </div>
      </div>
    </div>
  );
};
