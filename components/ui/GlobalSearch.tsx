import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const normalizeTerm = (value: string) => value.toLocaleLowerCase('ar-SY');

const buildHaystack = (values: Array<unknown>) =>
  values
    .map((value) => {
      if (value === null || value === undefined) return '';
      return String(value).toLocaleLowerCase('ar-SY');
    })
    .filter(Boolean)
    .join(' ');

interface SearchResult {
  id: number;
  type: 'hospital' | 'doctor' | 'nurse' | 'user';
  name: string;
  subtitle?: string;
  data: any;
}

type EntityKey = 'hospital' | 'doctor' | 'nurse' | 'user';

interface EntityCache {
  data: any[] | null;
  promise: Promise<any[]> | null;
  lastFetchedAt: number | null;
  normalized: string[] | null;
}

const ENTITY_CONFIG: Record<EntityKey, { endpoint: string; key: string; perPage: number }> = {
  hospital: { endpoint: '/admin/hospital/all', key: 'hospitals', perPage: 100 },
  doctor: { endpoint: '/admin/doctor/all', key: 'doctors', perPage: 100 },
  nurse: { endpoint: '/admin/nurse/all', key: 'nurses', perPage: 100 },
  user: { endpoint: '/admin/user/all', key: 'users', perPage: 100 },
};

const MAX_RESULTS_PER_TYPE = 5;
const MAX_PAGES_TO_SCAN = 3;

const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const activeSearchIdRef = useRef(0);
  const hasPrefetchedRef = useRef(false);

  const cacheRef = useRef<Record<EntityKey, EntityCache>>({
    hospital: { data: null, promise: null, lastFetchedAt: null, normalized: null },
    doctor: { data: null, promise: null, lastFetchedAt: null, normalized: null },
    nurse: { data: null, promise: null, lastFetchedAt: null, normalized: null },
    user: { data: null, promise: null, lastFetchedAt: null, normalized: null },
  });

  const extractPageData = useCallback((response: any, key: string, fallbackLastPage: number) => {
    let data: any[] = [];
    let lastPage = fallbackLastPage;

    if (response?.[key]?.data && Array.isArray(response[key].data)) {
      data = response[key].data;
      lastPage = response[key].last_page ?? lastPage;
    } else if (response?.[key] && Array.isArray(response[key])) {
      data = response[key];
    } else if (response?.data && Array.isArray(response.data)) {
      data = response.data;
    } else if (Array.isArray(response)) {
      data = response;
    }

    if (!Number.isFinite(lastPage) || lastPage < 1) {
      lastPage = fallbackLastPage;
    }

    return { data, lastPage };
  }, []);

  const loadEntityData = useCallback(async (entity: EntityKey): Promise<any[]> => {
    const config = ENTITY_CONFIG[entity];
    const aggregated: any[] = [];

    const firstResponse = await api.get(`${config.endpoint}?page=1&per_page=${config.perPage}`).catch(() => null);
    if (!firstResponse) {
      return aggregated;
    }

    const { data: firstPageData, lastPage } = extractPageData(firstResponse, config.key, 1);
    aggregated.push(...firstPageData);

    const totalPages = Math.min(Math.max(lastPage, 1), MAX_PAGES_TO_SCAN);

    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          api.get(`${config.endpoint}?page=${page}&per_page=${config.perPage}`).catch(() => null)
        );
      }

      const responses = await Promise.all(pagePromises);
      responses.forEach((response) => {
        if (!response) return;
        const { data } = extractPageData(response, config.key, 1);
        aggregated.push(...data);
      });
    }

    return aggregated;
  }, [extractPageData]);

  const fetchEntityData = useCallback(async (entity: EntityKey) => {
    const cache = cacheRef.current[entity];

    if (cache.data) {
      return cache.data;
    }

    if (!cache.promise) {
      cache.promise = loadEntityData(entity)
        .then((data) => {
          cache.data = data;
          cache.lastFetchedAt = Date.now();
          cache.normalized = null;
          return data;
        })
        .catch((error) => {
          cache.data = null;
          cache.lastFetchedAt = null;
          cache.normalized = null;
          throw error;
        })
        .finally(() => {
          cache.promise = null;
        });
    }

    return cache.promise;
  }, [loadEntityData]);

  // إغلاق النتائج عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // البحث مع debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchAll(query.trim());
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const prefetchAllEntities = useCallback(async () => {
    if (hasPrefetchedRef.current) return;
    hasPrefetchedRef.current = true;

    const entities: EntityKey[] = ['hospital', 'doctor', 'nurse', 'user'];
    for (const entity of entities) {
      try {
        await fetchEntityData(entity);
      } catch {
        // Ignore prefetch errors; search will retry on demand
      }
    }
  }, [fetchEntityData]);

  const searchAll = async (searchQuery: string) => {
    const searchId = ++activeSearchIdRef.current;
    setLoading(true);
    try {
      const [hospitalsRes, doctorsRes, nursesRes, usersRes] = await Promise.all([
        searchHospitals(searchQuery),
        searchDoctors(searchQuery),
        searchNurses(searchQuery),
        searchUsers(searchQuery),
      ]);

      const allResults: SearchResult[] = [
        ...hospitalsRes,
        ...doctorsRes,
        ...nursesRes,
        ...usersRes,
      ];

      if (activeSearchIdRef.current === searchId) {
        setResults(allResults);
        setShowResults(true);
      }
    } catch (error) {
      if (activeSearchIdRef.current === searchId) {
        setResults([]);
        setShowResults(false);
      }
    } finally {
      if (activeSearchIdRef.current === searchId) {
        setLoading(false);
      }
    }
  };

  const searchHospitals = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const cache = cacheRef.current.hospital;
      const hospitalsData = await fetchEntityData('hospital');

      if (!cache.normalized || cache.normalized.length !== hospitalsData.length) {
        cache.normalized = hospitalsData.map((h) =>
          buildHaystack([
            h?.full_name,
            h?.account?.email,
            h?.address,
            h?.account?.phone_number,
          ])
        );
      }

      const searchLower = normalizeTerm(searchQuery.trim());
      const results: SearchResult[] = [];

      for (let i = 0; i < hospitalsData.length; i++) {
        if (results.length >= MAX_RESULTS_PER_TYPE) break;
        if (!cache.normalized?.[i]) continue;
        if (!cache.normalized[i].includes(searchLower)) continue;

        const hospital = hospitalsData[i];
        if (!hospital?.id) continue;

        results.push({
          id: hospital.id,
          type: 'hospital',
          name: hospital.full_name || 'غير محدد',
          subtitle: hospital.account?.email || hospital.address || '',
          data: hospital,
        });
      }

      return results;
    } catch (error) {
      return [];
    }
  };

  const searchDoctors = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const cache = cacheRef.current.doctor;
      const doctorsData = await fetchEntityData('doctor');

      if (!cache.normalized || cache.normalized.length !== doctorsData.length) {
        cache.normalized = doctorsData.map((d) =>
          buildHaystack([
            d?.full_name,
            d?.account?.email,
            d?.account?.phone_number,
            d?.specialization?.name_ar,
            d?.specialization?.name_en,
          ])
        );
      }

      const searchLower = normalizeTerm(searchQuery.trim());
      const results: SearchResult[] = [];

      for (let i = 0; i < doctorsData.length; i++) {
        if (results.length >= MAX_RESULTS_PER_TYPE) break;
        if (!cache.normalized?.[i]) continue;
        if (!cache.normalized[i].includes(searchLower)) continue;

        const doctor = doctorsData[i];
        if (!doctor?.id) continue;

        results.push({
          id: doctor.id,
          type: 'doctor',
          name: doctor.full_name,
          subtitle: doctor.specialization?.name_ar || doctor.account?.email,
          data: doctor,
        });
      }

      return results;
    } catch (error) {
      return [];
    }
  };

  const searchNurses = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const cache = cacheRef.current.nurse;
      const nursesData = await fetchEntityData('nurse');

      if (!cache.normalized || cache.normalized.length !== nursesData.length) {
        cache.normalized = nursesData.map((n) =>
          buildHaystack([
            n?.full_name,
            n?.account?.email,
            n?.account?.phone_number,
            n?.graduation_type,
            n?.address,
          ])
        );
      }

      const searchLower = normalizeTerm(searchQuery.trim());
      const results: SearchResult[] = [];

      for (let i = 0; i < nursesData.length; i++) {
        if (results.length >= MAX_RESULTS_PER_TYPE) break;
        if (!cache.normalized?.[i]) continue;
        if (!cache.normalized[i].includes(searchLower)) continue;

        const nurse = nursesData[i];
        if (!nurse?.id) continue;

        results.push({
          id: nurse.id,
          type: 'nurse',
          name: nurse.full_name,
          subtitle: nurse.graduation_type || nurse.account?.email,
          data: nurse,
        });
      }

      return results;
    } catch (error) {
      return [];
    }
  };

  const searchUsers = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const cache = cacheRef.current.user;
      const usersData = await fetchEntityData('user');

      if (!cache.normalized || cache.normalized.length !== usersData.length) {
        cache.normalized = usersData.map((u) =>
          buildHaystack([
            u?.full_name,
            u?.account?.email,
            u?.account?.phone_number,
            u?.account?.username,
            u?.address,
          ])
        );
      }

      const searchLower = normalizeTerm(searchQuery.trim());
      const results: SearchResult[] = [];

      for (let i = 0; i < usersData.length; i++) {
        if (results.length >= MAX_RESULTS_PER_TYPE) break;
        if (!cache.normalized?.[i]) continue;
        if (!cache.normalized[i].includes(searchLower)) continue;

        const user = usersData[i];
        if (!user?.id) continue;

        results.push({
          id: user.id,
          type: 'user',
          name: user.full_name,
          subtitle: user.account?.email,
          data: user,
        });
      }

      return results;
    } catch (error) {
      return [];
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery('');
    setShowResults(false);
    setResults([]);

    switch (result.type) {
      case 'hospital':
        navigate(`/hospitals/${result.id}`);
        break;
      case 'doctor':
        navigate(`/doctors/${result.id}`);
        break;
      case 'nurse':
        navigate(`/nurses/${result.id}`);
        break;
      case 'user':
        navigate(`/users/${result.id}`, { state: { user: result.data } });
        break;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'hospital':
        return 'مشفى';
      case 'doctor':
        return 'طبيب';
      case 'nurse':
        return 'ممرض/ة';
      case 'user':
        return 'مستخدم';
    }
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'hospital':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'doctor':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'nurse':
        return (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'user':
        return (
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'hospital':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'doctor':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'nurse':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'user':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && results.length > 0 && setShowResults(true)}
          onClick={() => {
            if (query.trim().length >= 2 && results.length > 0) {
              setShowResults(true);
            }
          }}
          onFocusCapture={() => {
            void prefetchAllEntities();
          }}
          onClickCapture={() => {
            void prefetchAllEntities();
          }}
          placeholder="ابحث... (2 أحرف على الأقل)"
          className="w-full pr-10 pl-4 py-2.5 bg-slate-700/50 backdrop-blur-sm border border-slate-600 rounded-lg text-white placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent hover:border-slate-500"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
              activeSearchIdRef.current += 1;
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* نتائج البحث */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl shadow-2xl max-h-96 overflow-y-auto custom-scrollbar z-50 animate-scale-in">
          <div className="p-2">
            <div className="text-xs text-slate-400 px-3 py-2 font-medium">
              تم العثور على {results.length} نتيجة
            </div>
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => handleResultClick(result)}
                className="w-full text-right px-3 py-3 rounded-lg hover:bg-slate-700/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
                        {result.name}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getTypeColor(result.type)} flex-shrink-0`}>
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* لا توجد نتائج */}
      {showResults && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl shadow-2xl p-6 text-center z-50 animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">لم يتم العثور على نتائج لـ "{query}"</p>
          <p className="text-slate-500 text-xs mt-1">جرب البحث بكلمات أخرى أو تحقق من الإملاء</p>
        </div>
      )}
      
      {/* تنبيه: اكتب حرفين */}
      {query.trim().length === 1 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl shadow-2xl p-4 text-center z-50 animate-scale-in">
          <p className="text-slate-400 text-sm">اكتب حرفاً آخر للبحث...</p>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

