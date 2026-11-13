import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { NavigationLink } from '../../components/MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useKeyboardPage } from '../../hooks/useKeyboardViewport';
import { getCategories } from '../../services/api/category';
import { getProducts } from '../../services/api/product';
import RequestErrorNotice from '../../components/ui/RequestErrorNotice';
import { useMiniAppStore } from '../../store/miniAppStore';
import type { ProductViewMode } from '../../types/product';
import CategoryList from '../category/CategoryList';
import ProductList, { ProductSkeleton } from './ProductList';
import Icon from './component/Icon';
import CartBar from './component/CartBar';

export default function ProductsPage() {
  useKeyboardPage();
  const { t } = useTranslation();
  const sessionVersion = useMiniAppStore((state) => state.sessionVersion);
  const [selectedId, setSelectedId] = useState<number>();
  const [viewMode, setViewMode] = useState<ProductViewMode>(() => {
    try { return localStorage.getItem('list_style') === 'list' ? 'list' : 'grid'; }
    catch { return 'grid'; }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpen = useRef(false);
  const searchComposing = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('list_style', viewMode); }
    catch { /* Keep view switching usable when storage is unavailable. */ }
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!searchOpen && wasSearchOpen.current) searchButtonRef.current?.focus({ preventScroll: true });
    wasSearchOpen.current = searchOpen;
  }, [searchOpen]);

  const categories = useQuery({
    queryKey: ['categories', sessionVersion],
    queryFn: ({ signal }) => getCategories(signal),
  });
  const products = useQuery({
    queryKey: ['products', sessionVersion, selectedId ?? null, debouncedSearch],
    queryFn: ({ signal }) => getProducts({ category_id: selectedId, search_value: debouncedSearch }, signal),
  });

  function closeSearch() {
    inputRef.current?.blur();
    setSearchOpen(false);
    setSearch('');
    setDebouncedSearch('');
  }

  function clearSearch() {
    setSearch('');
    setDebouncedSearch('');
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <main className="products-page keyboard-page">
      <header className="products-header">
        <div className="products-toolbar mb-1" data-search-open={searchOpen}>
          <NavigationLink to="/" replace className="product-header-button product-back" aria-label={t('products.back')}><Icon name="back-ios" /></NavigationLink>
          <h1>{t('products.title')}</h1>
          {searchOpen && (
            <form id="product-search" className="product-search" role="search" onSubmit={(event) => { event.preventDefault(); if (!searchComposing.current) inputRef.current?.blur(); }}>
              <Icon name="search" />
              <input ref={inputRef} type="search" enterKeyHint="search" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={search} aria-label={t('products.search')} placeholder={t('products.searchPlaceholder')} onCompositionStart={() => { searchComposing.current = true; }} onCompositionEnd={() => { searchComposing.current = false; }} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return; if (event.key === 'Escape') closeSearch(); }} />
              <button type="button" className="product-search-clear" data-keep-keyboard aria-label={search ? t('products.clearSearch') : t('products.closeSearch')} onPointerDown={(event) => event.preventDefault()} onClick={() => search ? clearSearch() : closeSearch()}><Icon name="close" /></button>
            </form>
          )}
          <button type="button" ref={searchButtonRef} className="product-header-button" aria-label={t('products.search')} aria-expanded={searchOpen} aria-controls={searchOpen ? 'product-search' : undefined} onClick={() => { flushSync(() => setSearchOpen(true)); inputRef.current?.focus({ preventScroll: true }); }}><Icon name="search" /></button>
        </div>
        <CategoryList categories={categories.data ?? []} selectedId={selectedId} onSelect={setSelectedId} viewMode={viewMode} onViewModeChange={setViewMode} />
      </header>
      <div className="products-content" data-keyboard-scroll aria-busy={products.isFetching || categories.isFetching}>
        {categories.isError && (
          <RequestErrorNotice error={categories.error} retry={() => void categories.refetch()} />
        )}
        {products.isPending ? <ProductSkeleton viewMode={viewMode} /> : products.isError ? (
          <RequestErrorNotice error={products.error} retry={() => void products.refetch()} />
        ) : <ProductList products={products.data.results} categories={categories.data ?? []} viewMode={viewMode} />}
      </div>
      <CartBar />
    </main>
  );
}
