"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Icon } from "./icons";
import type { DataSource } from "@/lib/commerce/models";
import { FavoritesProvider } from "@/lib/commerce/favorites-provider";

const ToastContext = createContext<(message: string) => void>(() => {});
const AdminSourceContext = createContext<DataSource>("demo");
export const useStoreAdminSource = () => useContext(AdminSourceContext);
export function StoreProvider({
  children,
  adminSource,
  source,
}: {
  children: React.ReactNode;
  adminSource: DataSource;
  source: DataSource;
}) {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const notify = useCallback(
    (text: string) => setToast({ text, id: Date.now() }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <AdminSourceContext.Provider value={adminSource}>
      <ToastContext.Provider value={notify}>
        <FavoritesProvider source={source} notify={notify}>
          {children}
        </FavoritesProvider>
        <div className="s-toast-region" role="status" aria-live="polite">
          {toast && (
            <div className="s-toast">
              <Icon name="check" />
              {toast.text}
              <button
                className="s-icon-button"
                onClick={() => setToast(null)}
                aria-label="Закрыть уведомление"
              >
                <Icon name="close" />
              </button>
            </div>
          )}
        </div>
      </ToastContext.Provider>
    </AdminSourceContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
