import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createCompany, deleteCompany, listCompanies, updateCompany, type CompanyInput } from '../lib/appwrite/companies';
import { createPerson, deletePerson, listPersons, updatePerson, type PersonInput } from '../lib/appwrite/persons';
import type { Company, Person } from '../types/client';
import { useAuth } from './JobCardsContext';

interface ClientsContextValue {
  persons: Person[];
  companies: Company[];
  loading: boolean;
  refresh: () => Promise<void>;
  addPerson: (input: Omit<PersonInput, 'createdBy'>) => Promise<Person>;
  editPerson: (id: string, updates: Partial<PersonInput>) => Promise<Person>;
  removePerson: (id: string) => Promise<void>;
  addCompany: (input: Omit<CompanyInput, 'createdBy'>) => Promise<Company>;
  editCompany: (id: string, updates: Partial<CompanyInput>) => Promise<Company>;
  removeCompany: (id: string) => Promise<void>;
  findPerson: (id: string | null | undefined) => Person | undefined;
  findCompany: (id: string | null | undefined) => Company | undefined;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const [persons, setPersons] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isConfigured || !user) {
      setPersons([]);
      setCompanies([]);
      return;
    }
    const [p, c] = await Promise.all([listPersons(), listCompanies()]);
    setPersons(p);
    setCompanies(c);
  }, [isConfigured, user]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [refresh]);

  const addPerson = useCallback(
    async (input: Omit<PersonInput, 'createdBy'>) => {
      const created = await createPerson({ ...input, createdBy: user?.$id ?? '' });
      setPersons((prev) => [...prev, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      return created;
    },
    [user],
  );

  const editPerson = useCallback(async (id: string, updates: Partial<PersonInput>) => {
    const updated = await updatePerson(id, updates);
    setPersons((prev) =>
      prev
        .map((row) => (row.id === id ? updated : row))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    );
    return updated;
  }, []);

  const removePerson = useCallback(async (id: string) => {
    await deletePerson(id);
    setPersons((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const addCompany = useCallback(
    async (input: Omit<CompanyInput, 'createdBy'>) => {
      const created = await createCompany({ ...input, createdBy: user?.$id ?? '' });
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    },
    [user],
  );

  const editCompany = useCallback(async (id: string, updates: Partial<CompanyInput>) => {
    const updated = await updateCompany(id, updates);
    setCompanies((prev) =>
      prev
        .map((row) => (row.id === id ? updated : row))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    return updated;
  }, []);

  const removeCompany = useCallback(async (id: string) => {
    await deleteCompany(id);
    setCompanies((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const findPerson = useCallback(
    (id: string | null | undefined) => (id ? persons.find((p) => p.id === id) : undefined),
    [persons],
  );

  const findCompany = useCallback(
    (id: string | null | undefined) => (id ? companies.find((c) => c.id === id) : undefined),
    [companies],
  );

  const value = useMemo(
    () => ({
      persons,
      companies,
      loading,
      refresh,
      addPerson,
      editPerson,
      removePerson,
      addCompany,
      editCompany,
      removeCompany,
      findPerson,
      findCompany,
    }),
    [
      persons,
      companies,
      loading,
      refresh,
      addPerson,
      editPerson,
      removePerson,
      addCompany,
      editCompany,
      removeCompany,
      findPerson,
      findCompany,
    ],
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients() {
  const context = useContext(ClientsContext);
  if (!context) throw new Error('useClients must be used within ClientsProvider');
  return context;
}
